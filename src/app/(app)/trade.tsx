import { useLocalSearchParams } from "expo-router";
import { useAssetTrades, useHolding } from "@/api/hooks";
import { CardsSkeleton, ErrorText, Screen } from "@/components/ui";
import { TradeForm } from "@/components/trade-form";

export default function TradeScreen() {
  const { assetId, tradeId } = useLocalSearchParams<{ assetId: string; tradeId?: string }>();
  const holding = useHolding(assetId);
  const trades = useAssetTrades(tradeId ? assetId : undefined);
  if (holding.isPending || (tradeId && trades.isPending)) return <Screen><CardsSkeleton count={2} /></Screen>;
  if (!holding.data) return <Screen><ErrorText error={holding.error ?? new Error("Asset not found")} /></Screen>;
  const trade = tradeId ? trades.data?.find((x) => x.id === tradeId) : undefined;
  if (tradeId && !trade) return <Screen><ErrorText error={new Error("Entry not found")} /></Screen>;
  return <TradeForm key={tradeId ?? "new"} holding={holding.data} trade={trade} />;
}
