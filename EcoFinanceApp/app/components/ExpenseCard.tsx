import React from "react";
import { StyleSheet, View } from "react-native";
import { Card, Chip, Text } from "react-native-paper";
import { Expense } from "../services/api";
import { Colors } from "../constants/Colors";
import { useCurrency } from "../hooks/useCurrency";

interface ExpenseCardProps {
  expense: Expense;
}

export default function ExpenseCard({ expense }: ExpenseCardProps) {
  const { formatCurrency } = useCurrency();

  return (
    <Card style={styles.card} mode="contained">
      <Card.Content>
        <View style={styles.header}>
          <Text variant="titleMedium" style={styles.amount}>
            {formatCurrency(Number(expense.amount || 0))}
          </Text>
          <Chip style={styles.chip} textStyle={styles.chipText}>
            {expense.category_name || `Categoria #${expense.category_id}`}
          </Chip>
        </View>

        <Text variant="bodyLarge" style={styles.description}>
          {expense.description || "Sin descripcion"}
        </Text>

        <Text variant="bodyMedium" style={styles.date}>
          Fecha: {expense.date}
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    backgroundColor: Colors.surface,
    borderRadius: 18,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  amount: {
    color: Colors.primary,
    fontWeight: "700",
  },
  chip: {
    backgroundColor: Colors.accent,
  },
  chipText: {
    color: Colors.textPrimary,
  },
  description: {
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  date: {
    color: Colors.textSecondary,
  },
});
