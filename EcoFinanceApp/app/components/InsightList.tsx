import React from "react";
import { StyleSheet } from "react-native";
import { Card, Text } from "react-native-paper";
import { Colors } from "../constants/Colors";

export default function InsightList({
  items,
  titlePrefix,
}: {
  items?: string[];
  titlePrefix: string;
}) {
  return (
    <>
      {items?.map((line, index) => (
        <Card key={`${titlePrefix}-${index}`} style={styles.itemCard} mode="contained">
          <Card.Content>
            <Text variant="titleMedium" style={styles.itemTitle}>
              {titlePrefix} {index + 1}
            </Text>
            <Text style={styles.itemText}>{line}</Text>
          </Card.Content>
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  itemCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
  },
  itemTitle: {
    color: Colors.primary,
    fontWeight: "700",
    marginBottom: 6,
  },
  itemText: {
    color: Colors.textSecondary,
    marginBottom: 4,
  },
});
