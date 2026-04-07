import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { PieChart } from "react-native-chart-kit";
import { Card, Chip, SegmentedButtons, Text } from "react-native-paper";
import { Colors } from "../constants/Colors";
import { useAuth } from "../hooks/useAuth";
import { ClusterUser, mlService } from "../services/api";

const chartColors = ["#2D6A4F", "#40916C", "#74C69D", "#D8F3DC", "#1B4332"];

export default function MLScreen() {
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const [clusters, setClusters] = useState<ClusterUser[]>([]);
  const [kValue, setKValue] = useState("3");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.is_admin) {
      setLoading(false);
      setError("Solo el administrador puede ver esta sección.");
      return;
    }

    const loadClusters = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await mlService.getUserClusters(Number(kValue));
        setClusters(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No fue posible consultar el clustering."
        );
      } finally {
        setLoading(false);
      }
    };

    loadClusters();
  }, [kValue, user]);

  const groupedData = useMemo(() => {
    const map = new Map<number, number>();

    clusters.forEach((item) => {
      map.set(item.cluster, (map.get(item.cluster) || 0) + 1);
    });

    return Array.from(map.entries()).map(([cluster, count], index) => ({
      name: `Cluster ${cluster}`,
      population: count,
      color: chartColors[index % chartColors.length],
      legendFontColor: Colors.textPrimary,
      legendFontSize: 13,
    }));
  }, [clusters]);

  const isCompact = width < 640;
  const isLargeScreen = width >= 980;
  const chartWidth = Math.max(
    220,
    Math.min(width - (isCompact ? 48 : 64), isLargeScreen ? 500 : 360)
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.headerCard} mode="contained">
        <Card.Content>
          <Text variant="headlineSmall" style={styles.title}>
            Segmentacion de usuarios
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Analiza cuantos usuarios pertenecen a cada cluster devuelto por el
            modelo K-Means.
          </Text>

          <SegmentedButtons
            value={kValue}
            onValueChange={setKValue}
            buttons={[
              { value: "2", label: "k=2" },
              { value: "3", label: "k=3" },
              { value: "4", label: "k=4" },
            ]}
            style={styles.segmented}
          />

          {!loading && !error ? (
            <View style={styles.kpisRow}>
              <Chip style={styles.kpiChip}>{clusters.length} usuarios</Chip>
              <Chip style={styles.kpiChip}>{groupedData.length} clusters</Chip>
            </View>
          ) : null}
        </Card.Content>
      </Card>

      {loading ? (
        <Text style={styles.infoText}>Cargando datos del modelo...</Text>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {!loading && !error ? (
        <View style={[styles.layoutGrid, isLargeScreen ? styles.layoutGridLarge : null]}>
          {groupedData.length ? (
            <Card style={styles.chartCard} mode="contained">
              <Card.Content>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Distribucion por cluster
                </Text>
                <PieChart
                  data={groupedData}
                  width={chartWidth}
                  height={240}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="8"
                  absolute
                  chartConfig={{
                    color: () => Colors.primary,
                    labelColor: () => Colors.textPrimary,
                  }}
                />
              </Card.Content>
            </Card>
          ) : null}

          <View style={styles.listContainer}>
          {clusters.map((item, index) => (
            <Card
              key={`${item.user_id}-${index}`}
              style={styles.itemCard}
              mode="contained"
            >
              <Card.Content>
                <Text variant="titleMedium" style={styles.itemTitle}>
                  Usuario #{item.user_id}
                </Text>
                <Text style={styles.itemText}>Cluster asignado: {item.cluster}</Text>
                {item.email ? (
                  <Text style={styles.itemText}>Email: {item.email}</Text>
                ) : null}
                {typeof item.total_expense === "number" ? (
                  <Text style={styles.itemText}>
                    Gasto total: ${item.total_expense.toFixed(2)}
                  </Text>
                ) : null}
              </Card.Content>
            </Card>
          ))}
          </View>
        </View>
      ) : null}
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
    paddingBottom: 28,
    maxWidth: 1200,
    alignSelf: "center",
    width: "100%",
  },
  headerCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    marginBottom: 16,
  },
  title: {
    color: Colors.textPrimary,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  segmented: {
    marginTop: 8,
  },
  kpisRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  kpiChip: {
    backgroundColor: "#E8F4EC",
  },
  infoText: {
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  errorText: {
    color: Colors.error,
    marginBottom: 12,
  },
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    marginBottom: 16,
    flex: 1,
  },
  layoutGrid: {
    gap: 16,
  },
  layoutGridLarge: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  listContainer: {
    gap: 12,
    flex: 1,
  },
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
  sectionTitle: {
    color: Colors.textPrimary,
    fontWeight: "700",
    marginBottom: 12,
  },
});
