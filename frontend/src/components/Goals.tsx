import { useFocusEffect, useRouter } from "expo-router";
import { Baby, Flag, Gem, Heart, Plus, Sparkles, Sunset, Target, Trash2, Trophy } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { Button, Sheet } from "@/src/components/ui";
import { grams, inr, shortDate } from "@/src/format";
import { useApp } from "@/src/store/AppContext";
import { cardShadow, colors, fonts, radius } from "@/src/theme";

export type Goal = { id: string; name: string; occasion: string; target_grams: number; months: number; deadline: string; created_at: string };

export const OCCASIONS = [
  { id: "wedding", label: "Wedding", Icon: Heart },
  { id: "diwali", label: "Diwali", Icon: Sparkles },
  { id: "child", label: "Child's Future", Icon: Baby },
  { id: "retirement", label: "Retirement", Icon: Sunset },
  { id: "jewellery", label: "Jewellery", Icon: Gem },
  { id: "custom", label: "Custom", Icon: Flag },
];
const occ = (id: string) => OCCASIONS.find((o) => o.id === id) || OCCASIONS[5];

export function ProgressRing({ pct, size = 72, stroke = 7, done }: { pct: number; size?: number; stroke?: number; done?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceTertiary} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={done ? colors.success : colors.brandPrimary}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - p)}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={[styles.ringText, { fontSize: size > 64 ? 15 : 12 }]}>{Math.floor(p * 100)}%</Text>
    </View>
  );
}

function stats(goal: Goal, held: number, rate: number) {
  const pct = goal.target_grams ? held / goal.target_grams : 0;
  const remaining = Math.max(0, goal.target_grams - held);
  const monthsLeft = Math.max(1, Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (30.44 * 86400000)));
  const perMonth = (remaining / monthsLeft) * rate;
  return { pct, remaining, monthsLeft, perMonth, done: pct >= 1 };
}

export function useGoals() {
  const { token } = useApp();
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const load = useCallback(async () => {
    if (!token) return setGoals([]);
    try {
      setGoals(await api<Goal[]>("/goals"));
    } catch {
      setGoals([]);
    }
  }, [token]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  return { goals, load };
}

export function GoalsSection() {
  const { vault, price } = useApp();
  const router = useRouter();
  const toast = useToast();
  const { goals, load } = useGoals();
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<Goal | null>(null);
  const held = vault?.user.gold_grams ?? 0;
  const rate = price?.buy ?? vault?.buy_rate ?? 0;

  const remove = async () => {
    if (!del) return;
    await api(`/goals/${del.id}`, { method: "DELETE" }).catch(() => {});
    setDel(null);
    load();
    toast("info", "Goal removed");
  };

  return (
    <View style={styles.section} testID="goals-section">
      <View style={styles.head}>
        <Text style={styles.title}>Gold Goals</Text>
        <Pressable onPress={() => setOpen(true)} style={styles.addBtn} testID="goal-add-button">
          <Plus size={16} color={colors.onSurfaceInverse} />
          <Text style={styles.addText}>New goal</Text>
        </Pressable>
      </View>
      {goals && goals.length === 0 ? (
        <Pressable onPress={() => setOpen(true)} style={[styles.card, styles.empty]} testID="goals-empty">
          <View style={styles.emptyIcon}>
            <Target size={22} color={colors.brandSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>Set your first gold goal</Text>
            <Text style={styles.meta}>Save towards a wedding, Diwali or your child&apos;s future</Text>
          </View>
        </Pressable>
      ) : null}
      {(goals || []).map((g) => {
        const s = stats(g, held, rate);
        const O = occ(g.occasion);
        return (
          <View key={g.id} style={styles.card} testID={`goal-card-${g.id}`}>
            <View style={styles.row}>
              <ProgressRing pct={s.pct} done={s.done} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.nameRow}>
                  <O.Icon size={14} color={colors.brandSecondary} />
                  <Text style={styles.name} numberOfLines={1} testID={`goal-name-${g.id}`}>
                    {g.name}
                  </Text>
                </View>
                <Text style={styles.gramsLine} testID={`goal-progress-${g.id}`}>
                  {grams(Math.min(held, g.target_grams), 3)} <Text style={styles.meta}>of {grams(g.target_grams, 2)}</Text>
                </Text>
                <Text style={styles.meta}>By {shortDate(g.deadline)}</Text>
              </View>
              <Pressable onPress={() => setDel(g)} hitSlop={8} style={styles.trash} testID={`goal-delete-${g.id}`}>
                <Trash2 size={16} color={colors.mutedLight} />
              </Pressable>
            </View>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${Math.min(100, s.pct * 100)}%`, backgroundColor: s.done ? colors.success : colors.brandPrimary }]} />
            </View>
            {s.done ? (
              <View style={styles.doneRow} testID={`goal-achieved-${g.id}`}>
                <Trophy size={16} color={colors.success} />
                <Text style={styles.doneText}>Goal achieved! Redeem it as jewellery or coins.</Text>
              </View>
            ) : (
              <View style={styles.footer}>
                <Text style={[styles.meta, { flex: 1 }]} testID={`goal-plan-${g.id}`}>
                  Save <Text style={styles.strong}>{inr(s.perMonth, 0)}/month</Text> for {s.monthsLeft} mo to reach it
                </Text>
                <Pressable onPress={() => router.push("/sip")} style={styles.sipBtn} testID={`goal-sip-${g.id}`}>
                  <Text style={styles.sipText}>Start SIP</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
      <GoalSheet visible={open} onClose={() => setOpen(false)} onCreated={load} />
      <Sheet visible={!!del} onClose={() => setDel(null)} title="Remove this goal?" testID="goal-delete-sheet">
        <Text style={styles.meta}>Your gold stays in your vault. Only the goal tracker is removed.</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 16, marginBottom: 8 }}>
          <Button title="Keep" variant="outline" style={{ flex: 1 }} onPress={() => setDel(null)} testID="goal-delete-cancel" />
          <Button title="Remove" variant="danger" style={{ flex: 1 }} onPress={remove} testID="goal-delete-confirm" />
        </View>
      </Sheet>
    </View>
  );
}

const GRAM_CHIPS = [5, 10, 25, 50];
const MONTH_CHIPS = [
  { m: 3, label: "3 mo" },
  { m: 6, label: "6 mo" },
  { m: 12, label: "1 yr" },
  { m: 24, label: "2 yr" },
  { m: 60, label: "5 yr" },
];

function GoalSheet({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const { price, vault } = useApp();
  const toast = useToast();
  const [occasion, setOccasion] = useState("wedding");
  const [name, setName] = useState("");
  const [target, setTarget] = useState("10");
  const [months, setMonths] = useState(12);
  const [busy, setBusy] = useState(false);
  const t = parseFloat(target) || 0;
  const held = vault?.user.gold_grams ?? 0;
  const perMonth = (Math.max(0, t - held) / months) * (price?.buy ?? 0);

  const create = async () => {
    setBusy(true);
    try {
      const label = name.trim() || occ(occasion).label + " Fund";
      await api("/goals", { method: "POST", body: { name: label, occasion, target_grams: t, months } });
      toast("success", "Goal created", `${label} · ${grams(t, 2)}`);
      setName("");
      onCreated();
      onClose();
    } catch (e: any) {
      toast("error", "Could not create goal", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="New gold goal" testID="goal-sheet">
      <Text style={styles.label}>Occasion</Text>
      <View style={styles.wrap}>
        {OCCASIONS.map(({ id, label, Icon }) => (
          <Pressable key={id} onPress={() => setOccasion(id)} style={[styles.chip, occasion === id && styles.chipOn]} testID={`goal-occasion-${id}`}>
            <Icon size={14} color={occasion === id ? colors.onSurfaceInverse : colors.onSurfaceTertiary} />
            <Text style={[styles.chipText, occasion === id && { color: colors.onSurfaceInverse }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Goal name</Text>
      <TextInput
        testID="goal-name-input"
        value={name}
        onChangeText={(v) => setName(v.slice(0, 40))}
        placeholder={`${occ(occasion).label} Fund`}
        placeholderTextColor={colors.mutedLight}
        style={styles.input}
      />
      <Text style={styles.label}>Target (grams)</Text>
      <View style={styles.inputRow}>
        <TextInput
          testID="goal-target-input"
          value={target}
          onChangeText={(v) => setTarget(v.replace(/[^0-9.]/g, ""))}
          keyboardType="decimal-pad"
          style={[styles.input, { flex: 1 }]}
        />
        <Text style={styles.approx}>≈ {inr(t * (price?.buy ?? 0), 0)}</Text>
      </View>
      <View style={[styles.wrap, { marginTop: 8 }]}>
        {GRAM_CHIPS.map((g) => (
          <Pressable key={g} onPress={() => setTarget(String(g))} style={[styles.chip, t === g && styles.chipOn]} testID={`goal-target-${g}`}>
            <Text style={[styles.chipText, t === g && { color: colors.onSurfaceInverse }]}>{g}g</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Timeline</Text>
      <View style={styles.wrap}>
        {MONTH_CHIPS.map(({ m, label }) => (
          <Pressable key={m} onPress={() => setMonths(m)} style={[styles.chip, months === m && styles.chipOn]} testID={`goal-months-${m}`}>
            <Text style={[styles.chipText, months === m && { color: colors.onSurfaceInverse }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.plan} testID="goal-plan-preview">
        <Target size={18} color={colors.onBrandTertiary} />
        <Text style={styles.planText}>
          {t > held ? (
            <>
              Save about <Text style={styles.strong}>{inr(perMonth, 0)}/month</Text> to reach {grams(t, 2)} in {months} months
            </>
          ) : (
            "You already hold enough gold for this goal!"
          )}
        </Text>
      </View>
      <Button title="Create Goal" loading={busy} disabled={t <= 0} onPress={create} testID="goal-create-button" />
      <View style={{ height: 8 }} />
    </Sheet>
  );
}

/** Compact goal progress for Home. */
export function HomeGoalCard() {
  const { token, vault, price } = useApp();
  const router = useRouter();
  const { goals } = useGoals();
  if (!token || !goals) return null;
  const g = goals[0];
  const held = vault?.user.gold_grams ?? 0;
  return (
    <Pressable onPress={() => router.push("/vault")} style={styles.homeCard} testID="home-goal-card">
      {g ? <ProgressRing pct={held / g.target_grams} size={52} stroke={5} done={held >= g.target_grams} /> : <View style={styles.emptyIcon}><Target size={22} color={colors.brandSecondary} /></View>}
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {g ? g.name : "Gold Goals"}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {g ? `${grams(Math.min(held, g.target_grams), 3)} of ${grams(g.target_grams, 2)} · ${inr(stats(g, held, price?.buy ?? 0).perMonth, 0)}/mo` : "Set a savings goal and track your progress"}
        </Text>
      </View>
      <View style={styles.addBtn}>
        <Text style={styles.addText}>{g ? "View" : "Set"}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: 16, marginTop: 24, gap: 8 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  title: { fontFamily: fonts.black, fontSize: 20, letterSpacing: -0.6, color: colors.onSurface },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, height: 32, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.surfaceInverse },
  addText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.onSurfaceInverse },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 16, ...cardShadow },
  empty: { flexDirection: "row", alignItems: "center", gap: 12 },
  emptyIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.onSurface, letterSpacing: -0.3 },
  gramsLine: { fontFamily: fonts.bold, fontSize: 16, color: colors.onSurface },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  strong: { fontFamily: fonts.bold, color: colors.onSurface },
  ringText: { fontFamily: fonts.black, color: colors.onSurface, letterSpacing: -0.4 },
  trash: { width: 36, height: 36, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceTertiary, marginTop: 14, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  footer: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  sipBtn: { height: 32, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: "#F0E2B0", justifyContent: "center" },
  sipText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.onBrandTertiary },
  doneRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  doneText: { flex: 1, fontFamily: fonts.semibold, fontSize: 12, color: colors.success },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onSurfaceTertiary, marginTop: 16, marginBottom: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onSurfaceTertiary },
  input: { height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, fontFamily: fonts.semibold, fontSize: 15, color: colors.onSurface },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  approx: { fontFamily: fonts.bold, fontSize: 14, color: colors.onBrandTertiary },
  plan: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: 12, marginVertical: 16 },
  planText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.onBrandTertiary },
  homeCard: { marginHorizontal: 16, marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
