import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Chip, Surface, Text } from "react-native-paper";
import ExpenseCard from "../components/ExpenseCard";
import { Colors } from "../constants/Colors";
import { useAuth } from "../hooks/useAuth";
import { useCurrency } from "../hooks/useCurrency";
import { expenseService, Expense } from "../services/api";

export default function HistoryScreen() {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    if (!user) {
      setExpenses([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setError("");
      const response = await expenseService.getExpensesByUser(user.id);
      setExpenses(response);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No fue posible cargar el historial."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadHistory();
    }, [loadHistory])
  );

  const totalAmount = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          loadHistory();
        }} />
      }
    >
      <Surface style={styles.summaryCard} elevation={1}>
        <Text variant="headlineSmall" style={styles.title}>
          Historial de movimientos
        </Text>
        <Text style={styles.subtitle}>
          Revisa tus gastos registrados en orden reciente.
        </Text>
        <View style={styles.chipRow}>
          <Chip style={styles.chip}>Total de movimientos: {expenses.length}</Chip>
          <Chip style={styles.chip}>Acumulado: {formatCurrency(totalAmount)}</Chip>
        </View>
      </Surface>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <Text style={styles.loading}>Cargando historial...</Text> : null}

      {!loading && !expenses.length ? (
        <Surface style={styles.emptyCard} elevation={0}>
          <Text style={styles.emptyText}>
            Aún no tienes movimientos registrados en tu historial.
          </Text>
        </Surface>
      ) : null}

      {expenses.map((expense) => (
        <ExpenseCard key={expense.id} expense={expense} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    maxWidth: 900,
    width: "100%",
    alignSelf: "center",
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
  },
  title: {
    color: Colors.textPrimary,
    fontWeight: "800",
    marginBottom: 6,
  },
  subtitle: {
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    backgroundColor: "#EAF2FB",
  },
  error: {
    color: Colors.error,
    marginBottom: 12,
  },
  loading: {
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },
  emptyText: {
    color: Colors.textSecondary,
  },
});
