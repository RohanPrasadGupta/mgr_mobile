import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useAllTrades, usePortfolio } from "@/api/hooks";
import type { AssetClass, Holding, Trade } from "@/api/types";
import { BarChart } from "@/components/charts";
import { PortfolioChart } from "@/components/portfolio-chart";
import { Button, Card, CardsSkeleton, Empty, ErrorText, ListSkeleton, ProgressBar, Screen, T } from "@/components/ui";
import { assetIndex, classesOf, currenciesOf, lastMonths, monthlyCapital, recent, totalsByClass, yearlyCapital, type ClassTotals, type PerCurrency } from "@/lib/invest-board";
import { CLASS_CHART, CLASS_LABEL, TYPE_LABEL, isInflow } from "@/lib/investments";
import { formatMoney, formatPct, formatQty, formatUnitPrice, todayLocal } from "@/lib/money";
import { radius, useTheme } from "@/theme/theme";

const tone = (n: number | null) => (n === null || n === 0 ? "fg" : n > 0 ? "income" : "expense");
type Tab = "overview" | AssetClass;
type Portfolio = NonNullable<ReturnType<typeof usePortfolio>["data"]>;
const useClassColor = () => { const t = useTheme(); return (c: AssetClass) => t.chart[CLASS_CHART[c] % t.chart.length]!; };
/** Per-currency amounts as text; currencies are never added together. */
const showPer = (m: PerCurrency, sign = false) => { const e = Object.entries(m).filter(([, v]) => v !== 0); return e.length ? e.map(([c, v]) => formatMoney(v, c, { sign })).join(" · ") : "—"; };
const monthShort = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en", { month: "short", timeZone: "UTC" });

export default function Investments() {
  const qc = useQueryClient();
  const q = usePortfolio();
  const trades = useAllTrades();
  const color = useClassColor();
  const t = useTheme();
  const [tab, setTab] = useState<Tab>("overview");
  const p = q.data;
  const classes = p ? classesOf(p.holdings) : [];
  const active: Tab = tab !== "overview" && !classes.includes(tab) ? "overview" : tab;

  return (
    <Screen onRefresh={() => void qc.invalidateQueries({ queryKey: ["investments"] })} refreshing={q.isRefetching}>
      <T size={26} bold>Investments</T>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}><Button title={active === "overview" ? "+ Add asset" : `+ Add ${CLASS_LABEL[active].toLowerCase()}`} onPress={() => router.push(active === "overview" ? "/asset-new" : { pathname: "/asset-new", params: { cls: active } })} /></View>
        <View style={{ flex: 1 }}><Button title="SIP calculator" variant="ghost" onPress={() => router.push("/sip")} /></View>
      </View>
      {p && p.holdings.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={{ gap: 8 }}>
          {(["overview", ...classes] as Tab[]).map((k) => {
            const on = active === k;
            const c = k === "overview" ? t.primary : color(k);
            return (
              <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={k === "overview" ? "Overview" : CLASS_LABEL[k]} onPress={() => setTab(k)}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? c : t.border, backgroundColor: on && k === "overview" ? t.primary : "transparent" }}>
                {k !== "overview" && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c }} />}
                <T size={14} bold={on} style={{ color: on && k === "overview" ? t.primaryFg : on ? t.fg : t.muted }}>{k === "overview" ? "Overview" : CLASS_LABEL[k]}</T>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <ErrorText error={q.error} />
      {q.isPending ? <CardsSkeleton count={3} /> : p && (p.holdings.length === 0
        ? <Empty>No investments yet. Add an asset (a stock, crypto, a SIP or pension fund…) then record trades or contributions.</Empty>
        : active === "overview" ? <Overview p={p} trades={trades.data} onOpen={setTab} /> : <ClassTab cls={active} p={p} trades={trades.data} />)}
    </Screen>
  );
}

function Stat({ label, value, sub, tone: tn = "fg", color }: { label: string; value: string; sub?: string; tone?: "fg" | "income" | "expense"; color?: string }) {
  return (
    <Card style={{ flexBasis: "47%", flexGrow: 1, gap: 2 }}>
      <T tone="muted" size={12}>{label}</T>
      <T bold size={17} tone={tn} style={color ? { color } : undefined}>{value}</T>
      {sub ? <T tone="muted" size={11}>{sub}</T> : null}
    </Card>
  );
}

function CurrencyChips({ list, value, onChange }: { list: string[]; value: string; onChange: (c: string) => void }) {
  const t = useTheme();
  if (list.length < 2) return null;
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {list.map((c) => (
        <Pressable key={c} accessibilityRole="button" accessibilityState={{ selected: c === value }} onPress={() => onChange(c)} style={{ paddingVertical: 3, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: c === value ? t.primary : t.border }}>
          <T size={12} style={{ color: c === value ? t.primary : t.muted }}>{c}</T>
        </Pressable>
      ))}
    </View>
  );
}

function ClassCard({ c, onPress }: { c: ClassTotals; onPress: () => void }) {
  const color = useClassColor()(c.cls);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${CLASS_LABEL[c.cls]} capital ${showPer(c.capital)}, ${c.entries} entries`} onPress={onPress} style={({ pressed }) => ({ flexBasis: "47%", flexGrow: 1, opacity: pressed ? 0.7 : 1 })}>
      <Card style={{ gap: 2, borderTopWidth: 3, borderTopColor: color }}>
        <T tone="muted" size={11} bold>{CLASS_LABEL[c.cls].toUpperCase()} CAPITAL</T>
        <T bold size={16} style={{ color }}>{showPer(c.capital)}</T>
        <T tone="muted" size={11}>{c.entries} {c.entries === 1 ? "entry" : "entries"} · {c.open}/{c.holdings} open</T>
      </Card>
    </Pressable>
  );
}

function Overview({ p, trades, onOpen }: { p: Portfolio; trades?: Trade[]; onOpen: (t: Tab) => void }) {
  const color = useClassColor();
  const base = p.baseCurrency;
  const totals = totalsByClass(p.holdings);
  const assets = assetIndex(p.holdings);
  const months = lastMonths(todayLocal(), 12);
  const curs = trades ? currenciesOf(trades, assets) : [];
  const [cur, setCur] = useState<string | null>(null);
  const chartCur = cur && curs.includes(cur) ? cur : curs[0];
  const monthly = trades && chartCur ? monthlyCapital(trades, assets, chartCur, months) : {};
  const maxEntries = Math.max(1, ...totals.map((x) => x.entries));
  return (
    <>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <Stat label="Portfolio value" value={formatMoney(p.marketValueMinor, base)} />
        <Stat label="Invested (cost)" value={formatMoney(p.investedMinor, base)} />
        <Stat label="Unrealised P/L" value={formatMoney(p.unrealisedPnlMinor, base, { sign: true })} tone={tone(p.unrealisedPnlMinor)} />
        <Stat label="Realised P/L" value={formatMoney(p.realisedPnlMinor, base, { sign: true })} tone={tone(p.realisedPnlMinor)} />
      </View>
      <T tone="muted" size={12}>Annualised return (XIRR): <T size={12} bold tone={tone(p.xirrPct)}>{formatPct(p.xirrPct, true)}</T>{p.approximate ? ` · totals in ${base} at today's FX rate` : ""}</T>
      {p.excluded.length > 0 && <Card><T tone="warn" size={13}>Not included in the {base} totals: {p.excluded.map((e) => `${e.symbol} (${e.reason})`).join(", ")}.</T></Card>}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }} accessibilityLabel="By type">
        {totals.map((c) => <ClassCard key={c.cls} c={c} onPress={() => onOpen(c.cls)} />)}
      </View>

      <Card style={{ gap: 10 }}>
        <T bold>Allocation <T tone="muted" size={13}>({base})</T></T>
        {p.allocation.map((a) => (
          <View key={a.class} style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}><T>{CLASS_LABEL[a.class as AssetClass]}</T><T tone="muted" size={13}>{formatMoney(a.valueMinor, base)} · {a.pct.toFixed(0)}%</T></View>
            <ProgressBar pct={a.pct} color={color(a.class as AssetClass)} />
          </View>
        ))}
      </Card>

      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
          <T bold>Capital added per month{chartCur ? <T tone="muted" size={13}> ({chartCur})</T> : null}</T>
          <CurrencyChips list={curs} value={chartCur ?? ""} onChange={setCur} />
        </View>
        {!trades ? <ListSkeleton rows={2} /> : !chartCur || Object.keys(monthly).length === 0 ? <T tone="muted">Nothing added in the last 12 months.</T> : (
          <BarChart labels={months.map(monthShort)} format={(v) => formatMoney(v, chartCur, { sign: true })}
            series={(Object.keys(monthly) as AssetClass[]).map((c) => ({ name: CLASS_LABEL[c], values: monthly[c]!.map((v) => Math.max(0, v)), color: color(c) }))} />
        )}
        <T tone="muted" size={11}>Buys and contributions minus sells and withdrawals, per currency (never mixed).</T>
      </Card>

      <Card style={{ gap: 10 }}>
        <T bold>Entries by type</T>
        {totals.map((c) => (
          <View key={c.cls} style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}><T>{CLASS_LABEL[c.cls]}</T><T bold style={{ color: color(c.cls) }}>{c.entries}</T></View>
            <ProgressBar pct={(c.entries / maxEntries) * 100} color={color(c.cls)} />
          </View>
        ))}
      </Card>

      <Card style={{ gap: 4 }}>
        <T bold>Recent activity</T>
        {!trades ? <ListSkeleton rows={3} /> : <Activity trades={recent(trades, 8)} assets={assets} />}
      </Card>

      <PortfolioChart />
    </>
  );
}

function Activity({ trades, assets }: { trades: Trade[]; assets: ReturnType<typeof assetIndex> }) {
  const color = useClassColor();
  const t = useTheme();
  if (trades.length === 0) return <T tone="muted">Nothing recorded yet.</T>;
  return (
    <View accessibilityLabel="Recent activity">
      {trades.map((tr, i) => {
        const a = assets.get(tr.assetId);
        if (!a) return null;
        const inflow = isInflow(tr.type);
        return (
          <Pressable key={tr.id} accessibilityRole="button" accessibilityLabel={`${CLASS_LABEL[a.cls]} ${a.symbol} ${TYPE_LABEL[tr.type]} ${tr.tradedOn}`} onPress={() => router.push({ pathname: "/investments/[id]", params: { id: tr.assetId } })}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, opacity: pressed ? 0.6 : 1, borderTopWidth: i ? 1 : 0, borderTopColor: t.border })}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: color(a.cls), alignItems: "center", justifyContent: "center" }}><T size={13} style={{ color: "#fff" }}>{inflow ? "↘" : "↗"}</T></View>
            <View style={{ flex: 1 }}>
              <T size={14} bold numberOfLines={1}>{CLASS_LABEL[a.cls]} · {a.symbol} <T tone="muted" size={13}>· {TYPE_LABEL[tr.type]}{tr.quantity !== null ? ` ${formatQty(tr.quantity)}` : ""}</T></T>
              <T tone="muted" size={12}>{tr.tradedOn}</T>
            </View>
            <T bold size={14} tone={tr.type === "bonus" ? "muted" : inflow ? "income" : "fg"}>{tr.type === "bonus" ? "free" : `${inflow ? "+" : ""}${formatMoney(tr.amountMinor, a.currency)}`}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

function ClassTab({ cls, p, trades }: { cls: AssetClass; p: Portfolio; trades?: Trade[] }) {
  const color = useClassColor()(cls);
  const holdings = p.holdings.filter((h) => h.asset.class === cls).sort((x, y) => Number(x.closed) - Number(y.closed));
  const c = totalsByClass(holdings)[0]!;
  const units = holdings.some((h) => h.asset.tracking === "units");
  const assets = assetIndex(p.holdings);
  const curs = trades ? currenciesOf(trades, assets, cls) : [];
  const [cur, setCur] = useState<string | null>(null);
  const chartCur = cur && curs.includes(cur) ? cur : curs[0];
  const yearly = trades && chartCur ? yearlyCapital(trades, assets, cls, chartCur) : null;
  return (
    <>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <Stat label="Capital at stake" value={showPer(c.capital)} color={color} sub={units ? "cost of what you hold" : "contributions − withdrawals"} />
        <Stat label={units ? "Total bought" : "Total contributed"} value={showPer(c.putIn)} sub="everything put in" />
        {units ? <Stat label="Realised P/L" value={showPer(c.realised, true)} sub="on units sold" /> : <Stat label="Current value" value={showPer(c.value)} sub="latest value, else cost" />}
        <Stat label="Entries" value={String(c.entries)} sub={`${c.open} of ${c.holdings} open`} />
      </View>
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
          <T bold>Capital added per year{chartCur ? <T tone="muted" size={13}> ({chartCur})</T> : null}</T>
          <CurrencyChips list={curs} value={chartCur ?? ""} onChange={setCur} />
        </View>
        {!yearly ? <ListSkeleton rows={2} /> : yearly.years.length === 0 ? <T tone="muted">No entries yet.</T> : (
          <BarChart labels={yearly.years} format={(v) => formatMoney(v, chartCur!, { sign: true })} series={[{ name: "Capital added", values: yearly.values.map((v) => Math.max(0, v)), color }]} />
        )}
      </Card>
      {holdings.map((h) => <HoldingCard key={h.asset.id} h={h} />)}
      <Card style={{ gap: 4 }}>
        <T bold>Latest {CLASS_LABEL[cls].toLowerCase()} entries</T>
        {!trades ? <ListSkeleton rows={3} /> : <Activity trades={recent(trades, 12, cls, assets)} assets={assets} />}
      </Card>
    </>
  );
}

function Figure({ label, value, note, tn = "fg", color }: { label: string; value: string; note: string; tn?: "fg" | "income" | "expense"; color?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexBasis: "47%", flexGrow: 1, borderWidth: 1, borderColor: t.border, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 10, alignItems: "center" }}>
      <T tone="muted" size={10} bold>{label.toUpperCase()}</T>
      <T bold size={14} tone={tn} style={color ? { color } : undefined} numberOfLines={1} adjustsFontSizeToFit>{value}</T>
      <T tone="muted" size={10}>{note}</T>
    </View>
  );
}

/** A holding with its key figures, latest buy/sell price and units; faded when nothing is left. */
function HoldingCard({ h }: { h: Holding }) {
  const t = useTheme();
  const color = useClassColor()(h.asset.class);
  const a = h.asset;
  const units = a.tracking === "units";
  const m = (n: number, sign = false) => formatMoney(n, a.currency, { sign });
  const sold = h.totalSoldMinor > 0;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${a.symbol}${h.closed ? " (closed)" : ""}`} onPress={() => router.push({ pathname: "/investments/[id]", params: { id: a.id } })}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : h.closed ? 0.55 : 1 })}>
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
          <T bold size={16}>{a.symbol}</T><T tone="muted" size={12}>{CLASS_LABEL[a.class]} · {a.currency}</T>
        </View>
        <T size={13} numberOfLines={1} style={{ color: t.primary }}>{a.name}</T>
        <T tone="muted" size={12}>{h.tradeCount} {h.tradeCount === 1 ? "entry" : "entries"}{units ? ` · ${h.closed ? "0 units (closed)" : `${formatQty(h.quantity)} units`}` : ""}</T>
        {(h.lastBuyPriceMinor !== null || h.lastSellPriceMinor !== null) && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {h.lastBuyPriceMinor !== null && <View style={{ borderWidth: 1, borderColor: t.income, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}><T size={11} tone="income">↗ Last buy: {formatUnitPrice(h.lastBuyPriceMinor, a.currency)}</T></View>}
            {h.lastSellPriceMinor !== null && <View style={{ borderWidth: 1, borderColor: t.expense, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}><T size={11} tone="expense">↘ Last sell: {formatUnitPrice(h.lastSellPriceMinor, a.currency)}</T></View>}
          </View>
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {units ? (<>
            <Figure label="Avg price" value={h.avgCostMinor === null ? "—" : formatUnitPrice(h.avgCostMinor, a.currency)} note="per unit" />
            <Figure label="Total bought" value={m(h.totalBoughtMinor)} note="all buys ever" tn="income" />
            {sold && <Figure label="Sold" value={m(h.totalSoldMinor)} note="received" tn="expense" />}
            <Figure label="Remaining" value={m(h.remainingCostMinor)} note="capital at stake" color={t.primary} />
            {h.marketValueMinor !== null && !h.closed
              ? <Figure label="Unrealised" value={m(h.unrealisedPnlMinor ?? 0, true)} note={`value ${m(h.marketValueMinor)}`} tn={tone(h.unrealisedPnlMinor)} />
              : <Figure label="Realised P/L" value={sold ? m(h.realisedPnlMinor, true) : "—"} note={sold ? "on sold units" : "no sells yet"} tn={tone(h.realisedPnlMinor)} />}
          </>) : (<>
            <Figure label="Contributed" value={m(h.contributedMinor)} note="paid in" tn="income" />
            {h.withdrawnMinor > 0 && <Figure label="Withdrawn" value={m(h.withdrawnMinor)} note="taken out" tn="expense" />}
            <Figure label="Net invested" value={m(h.remainingCostMinor)} note="capital at stake" color={t.primary} />
            <Figure label="Current value" value={h.marketValueMinor === null ? "—" : m(h.marketValueMinor)} note={h.marketValueMinor === null ? "no value set" : `${formatPct(h.returnPct, true)} return`} tn={tone(h.unrealisedPnlMinor)} />
          </>)}
        </View>
      </Card>
    </Pressable>
  );
}
