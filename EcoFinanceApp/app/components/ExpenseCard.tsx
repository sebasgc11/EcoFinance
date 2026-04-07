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
  const movementMeta =
    expense.movement_type === "income"
      ? {
          label: "Ingreso",
          amountColor: Colors.success,
          chipColor: "#E7F8EE",
        }
      : expense.movement_type === "investment"
        ? {
            label: "Inversión",
            amountColor: "#7C5CFA",
            chipColor: "#EFEAFE",
          }
        : {
            label: "Gasto",
            amountColor: Colors.primary,
            chipColor: Colors.accent,
          };

  return (
    <Card style={styles.card} mode="contained">
      <Card.Content>
        <View style={styles.header}>
          <Text
            variant="titleMedium"
            style={[styles.amount, { color: movementMeta.amountColor }]}
          >
            {formatCurrency(Number(expense.amount || 0))}
          </Text>
          <Chip style={[styles.chip, { backgroundColor: movementMeta.chipColor }]} textStyle={styles.chipText}>
            {expense.category_name || `Categoria #${expense.category_id}`}
          </Chip>
        </View>

        <Chip style={styles.typeChip} textStyle={styles.typeChipText}>
          {movementMeta.label}
        </Chip>

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
    fontWeight: "700",
  },
  chip: {
    alignSelf: "flex-start",
  },
  chipText: {
    color: Colors.textPrimary,
  },
  typeChip: {
    alignSelf: "flex-start",
    backgroundColor: "#EEF5FB",
    marginBottom: 10,
  },
  typeChipText: {
    color: Colors.textSecondary,
  },
  description: {
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  date: {
    color: Colors.textSecondary,
  },
});
