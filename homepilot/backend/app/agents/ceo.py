from __future__ import annotations

from typing import Any, AsyncIterator

from app.agents.base import Agent
from app.agents.family_fit import FamilyFitAgent, FamilyFitInput
from app.agents.future_outlook import FutureOutlookAgent, FutureOutlookInput
from app.agents.hidden_cost import HiddenCostAgent, HiddenCostInput
from app.agents.property_intelligence import PropertyIntelligenceAgent, PropertyIntelligenceInput
from app.agents.property_value import PropertyValueAgent, PropertyValueInput
from app.core.config import get_settings
from app.models import PropertyListing, PropertyRecommendation, RecommendationRequest, RecommendationResponse
from app.services.progress import stream_with_subtasks

AGENT_PROGRESS_STEPS: tuple[tuple[str, str], ...] = (
    (
        "property_intelligence",
        "Inspecting listing photos and condition signals",
    ),
    (
        "hidden_cost",
        "Estimating taxes, utilities, insurance, and maintenance",
    ),
    (
        "family_fit",
        "Scoring school, commute, safety, and lifestyle fit",
    ),
    (
        "property_value",
        "Comparing asking price to estimated fair value",
    ),
    (
        "future_outlook",
        "Evaluating area appreciation and planning signals",
    ),
)


class CEOAgent(Agent[RecommendationRequest, RecommendationResponse]):
    """Coordinates specialist agents and assembles ranked recommendations."""

    name = "ceo"

    def __init__(
        self,
        property_intelligence_agent: PropertyIntelligenceAgent | None = None,
        hidden_cost_agent: HiddenCostAgent | None = None,
        family_fit_agent: FamilyFitAgent | None = None,
        property_value_agent: PropertyValueAgent | None = None,
        future_outlook_agent: FutureOutlookAgent | None = None,
        weights: dict[str, float] | None = None,
    ) -> None:
        self.property_intelligence_agent = (
            property_intelligence_agent or PropertyIntelligenceAgent()
        )
        self.hidden_cost_agent = hidden_cost_agent or HiddenCostAgent()
        self.family_fit_agent = family_fit_agent or FamilyFitAgent()
        self.property_value_agent = property_value_agent or PropertyValueAgent()
        self.future_outlook_agent = future_outlook_agent or FutureOutlookAgent()
        self.weights = weights or self._default_weights()

    @staticmethod
    def _default_weights() -> dict[str, float]:
        settings = get_settings()
        return {
            "family_fit": settings.weight_family_fit,
            "property_value": settings.weight_property_value,
            "future_outlook": settings.weight_future_outlook,
            "property_quality": settings.weight_property_quality,
            "hidden_cost": settings.weight_hidden_cost,
        }

    async def run(self, payload: RecommendationRequest) -> RecommendationResponse:
        response: RecommendationResponse | None = None

        async for event in self.run_stream(payload):
            if event["type"] == "complete":
                response = RecommendationResponse.model_validate(event["result"])

        if response is None:
            raise RuntimeError("CEO agent stream ended without a complete event.")

        return response

    async def run_stream(
        self,
        payload: RecommendationRequest,
    ) -> AsyncIterator[dict[str, Any]]:
        recommendations = []
        property_total = len(payload.properties)

        for property_index, property_listing in enumerate(payload.properties, start=1):
            yield self._property_started_event(
                property_listing=property_listing,
                property_index=property_index,
                property_total=property_total,
            )

            yield self._agent_started_event("property_intelligence", property_listing)
            async for event in self._run_agent(
                "property_intelligence",
                property_listing,
                self.property_intelligence_agent.run(
                    PropertyIntelligenceInput(property=property_listing)
                ),
            ):
                if event[0] == "sub_task":
                    yield event[1]
                else:
                    property_intelligence = event[1]
            yield self._agent_completed_event("property_intelligence", property_listing)

            yield self._agent_started_event("hidden_cost", property_listing)
            async for event in self._run_agent(
                "hidden_cost",
                property_listing,
                self.hidden_cost_agent.run(
                    HiddenCostInput(
                        property=property_listing,
                        property_intelligence=property_intelligence,
                    )
                ),
            ):
                if event[0] == "sub_task":
                    yield event[1]
                else:
                    hidden_cost = event[1]
            yield self._agent_completed_event("hidden_cost", property_listing)

            yield self._agent_started_event("family_fit", property_listing)
            async for event in self._run_agent(
                "family_fit",
                property_listing,
                self.family_fit_agent.run(
                    FamilyFitInput(buyer=payload.buyer, property=property_listing)
                ),
            ):
                if event[0] == "sub_task":
                    yield event[1]
                else:
                    family_fit = event[1]
            yield self._agent_completed_event("family_fit", property_listing)

            yield self._agent_started_event("property_value", property_listing)
            async for event in self._run_agent(
                "property_value",
                property_listing,
                self.property_value_agent.run(
                    PropertyValueInput(
                        property=property_listing,
                        property_intelligence=property_intelligence,
                    )
                ),
            ):
                if event[0] == "sub_task":
                    yield event[1]
                else:
                    property_value = event[1]
            yield self._agent_completed_event("property_value", property_listing)

            yield self._agent_started_event("future_outlook", property_listing)
            async for event in self._run_agent(
                "future_outlook",
                property_listing,
                self.future_outlook_agent.run(
                    FutureOutlookInput(property=property_listing)
                ),
            ):
                if event[0] == "sub_task":
                    yield event[1]
                else:
                    future_outlook = event[1]
            yield self._agent_completed_event("future_outlook", property_listing)

            hidden_cost_score = self._score_hidden_cost(
                true_annual_cost=hidden_cost.true_annual_cost,
                listing_price=property_listing.listing_price,
            )
            overall_score = self._score_recommendation(
                family_fit_score=family_fit.family_fit_score,
                property_quality_score=property_intelligence.property_quality_score,
                hidden_cost_score=hidden_cost_score,
                property_value_score=property_value.deal_score,
                future_outlook_score=future_outlook.future_score,
            )

            recommendations.append(
                PropertyRecommendation(
                    rank=1,
                    property=property_listing,
                    overall_score=overall_score,
                    property_intelligence=property_intelligence,
                    hidden_cost=hidden_cost,
                    family_fit=family_fit,
                    property_value=property_value,
                    future_outlook=future_outlook,
                    recommendation_summary=self._build_summary(
                        property_quality_score=property_intelligence.property_quality_score,
                        family_fit_score=family_fit.family_fit_score,
                        true_annual_cost=hidden_cost.true_annual_cost,
                        property_value=property_value,
                        future_outlook=future_outlook,
                    ),
                    tradeoffs=self._build_tradeoffs(
                        repair_risk_score=property_intelligence.repair_risk_score,
                        family_fit_score=family_fit.family_fit_score,
                        hidden_cost_score=hidden_cost_score,
                        property_value_score=property_value.deal_score,
                        future_outlook_score=future_outlook.future_score,
                    ),
                )
            )

            yield {
                "type": "property_completed",
                "property_id": property_listing.id,
                "property_index": property_index,
                "property_total": property_total,
                "label": self._property_label(property_listing),
            }

        yield {
            "type": "stage",
            "stage": "ranking",
            "message": "CEO agent is ranking all properties by overall score",
        }

        ranked_recommendations = sorted(
            recommendations,
            key=lambda recommendation: recommendation.overall_score,
            reverse=True,
        )

        for rank, recommendation in enumerate(ranked_recommendations, start=1):
            recommendation.rank = rank

        response = RecommendationResponse(recommendations=ranked_recommendations)
        yield {
            "type": "complete",
            "result": response.model_dump(mode="json"),
        }

    async def _run_agent(
        self,
        agent_name: str,
        property_listing: PropertyListing,
        coro: Any,
    ) -> AsyncIterator[tuple[str, Any]]:
        """Run a specialist agent, forwarding its live subtask events."""

        async for kind, value in stream_with_subtasks(
            coro,
            agent=agent_name,
            property_id=property_listing.id,
        ):
            yield kind, value

    def _property_label(self, property_listing: PropertyListing) -> str:
        if property_listing.location.address:
            return property_listing.location.address
        if property_listing.location.city:
            return property_listing.location.city
        return property_listing.id

    def _property_started_event(
        self,
        property_listing: PropertyListing,
        property_index: int,
        property_total: int,
    ) -> dict[str, Any]:
        return {
            "type": "property_started",
            "property_id": property_listing.id,
            "property_index": property_index,
            "property_total": property_total,
            "label": self._property_label(property_listing),
            "message": f"Analyzing property {property_index} of {property_total}",
        }

    def _agent_started_event(
        self,
        agent: str,
        property_listing: PropertyListing,
    ) -> dict[str, Any]:
        message = next(
            (description for key, description in AGENT_PROGRESS_STEPS if key == agent),
            "Running specialist agent",
        )
        return {
            "type": "agent_started",
            "agent": agent,
            "property_id": property_listing.id,
            "message": message,
        }

    def _agent_completed_event(
        self,
        agent: str,
        property_listing: PropertyListing,
    ) -> dict[str, Any]:
        return {
            "type": "agent_completed",
            "agent": agent,
            "property_id": property_listing.id,
        }

    def _score_recommendation(
        self,
        family_fit_score: float,
        property_quality_score: float,
        hidden_cost_score: float,
        property_value_score: float,
        future_outlook_score: float,
    ) -> float:
        components = {
            "family_fit": family_fit_score,
            "property_value": property_value_score,
            "future_outlook": future_outlook_score,
            "property_quality": property_quality_score,
            "hidden_cost": hidden_cost_score,
        }
        total_weight = sum(self.weights.values()) or 1.0
        score = sum(self.weights[key] * value for key, value in components.items())
        return round(score / total_weight, 2)

    def _score_hidden_cost(self, true_annual_cost: int, listing_price: int) -> float:
        annual_cost_ratio = true_annual_cost / listing_price
        score = 100 - ((annual_cost_ratio - 0.01) / 0.02 * 100)
        return round(min(100, max(0, score)), 2)

    def _build_summary(
        self,
        property_quality_score: float,
        family_fit_score: float,
        true_annual_cost: int,
        property_value,
        future_outlook,
    ) -> str:
        return (
            "This home was ranked using family fit, property quality, ownership cost, "
            "fair-value pricing, and future outlook. It scored "
            f"{family_fit_score:.1f} for family fit and {property_quality_score:.1f} for "
            f"property quality, with an estimated annual ownership cost of "
            f"${true_annual_cost:,}. Estimated fair value is "
            f"${property_value.estimated_value:,} versus an asking price of "
            f"${property_value.asking_price:,} ({property_value.value_gap_pct:+.1%}), and the "
            f"area's future outlook scored {future_outlook.future_score:.0f}."
        )

    def _build_tradeoffs(
        self,
        repair_risk_score: float,
        family_fit_score: float,
        hidden_cost_score: float,
        property_value_score: float,
        future_outlook_score: float,
    ) -> list[str]:
        tradeoffs = []

        if repair_risk_score >= 60:
            tradeoffs.append("Higher repair risk may require additional inspection focus.")
        if family_fit_score < 70:
            tradeoffs.append("Family fit is weaker than ideal for this buyer profile.")
        if hidden_cost_score < 70:
            tradeoffs.append("Estimated ownership costs are relatively high for the price.")
        if property_value_score < 50:
            tradeoffs.append("Asking price looks high relative to estimated fair value.")
        if future_outlook_score < 60:
            tradeoffs.append("Area shows limited future appreciation signals.")

        return tradeoffs
