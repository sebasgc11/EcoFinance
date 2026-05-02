import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { PieChart } from "react-native-chart-kit";
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Dialog,
  Portal,
  SegmentedButtons,
  Text,
  TextInput,
} from "react-native-paper";
import { Colors } from "../constants/Colors";
import { useAuth } from "../hooks/useAuth";
import { AdminInsights, ClusterUser, UserInsights, UserRisk, mlService } from "../services/api";

const chartColors = ["#2D6A4F", "#40916C", "#74C69D", "#D8F3DC", "#1B4332"];

type PipelineSummary = {
  runId: string;
  modelVersion: string;
  combinedRows: number;
  preparedRows: number;
  syntheticRows: number;
  f1: number;
  recall: number;
  auc: number;
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

function composeAnalysisText(
  conclusions?: string[] | null,
  suggestions?: string[] | null
) {
  const cleanConclusions = (conclusions || []).filter(Boolean).join(" ").trim();
  const cleanSuggestions = (suggestions || []).filter(Boolean).join(" ").trim();

  if (cleanConclusions && cleanSuggestions) {
    return `${cleanConclusions} ${cleanSuggestions}`.trim();
  }

  return (cleanConclusions || cleanSuggestions || "Aun no hay analisis disponible.").trim();
}

type ProofSnapshot = {
  runId: string;
  executedAt: string;
  modelVersion: string;
  selectedModel: string;
  splitStrategy: string;
  combinedRows: number;
  preparedRows: number;
  syntheticRows: number;
  f1: number;
  recall: number;
  auc: number;
  riskLabel?: string;
  riskProbability?: number | null;
};

function buildProofSnapshot(
  report: Record<string, unknown>,
  risk?: UserRisk | null
): ProofSnapshot | null {
  const phases = Array.isArray(report.phases)
    ? (report.phases as Array<Record<string, unknown>>)
    : [];

  if (!phases.length) {
    return null;
  }

  const dataEngineering = phases.find((phase) => phase.phase === "data_engineering");
  const modelEvaluation = phases.find((phase) => phase.phase === "model_evaluation");
  const deployment = (report.deployment || {}) as Record<string, unknown>;
  const qa = (dataEngineering?.qa || {}) as Record<string, unknown>;
  const metrics = (modelEvaluation?.metrics || {}) as Record<string, unknown>;

  return {
    runId: String(report.run_id || "N/A"),
    executedAt: String(report.executed_at || "N/A"),
    modelVersion: String(deployment.model_version || "N/A"),
    selectedModel: String(modelEvaluation?.selected_model || "N/A"),
    splitStrategy: String(modelEvaluation?.split_strategy || "N/A"),
    combinedRows: Number(qa.combined_rows || 0),
    preparedRows: Number(qa.prepared_rows || 0),
    syntheticRows: Number(qa.synthetic_rows || 0),
    f1: Number(metrics.f1 || 0),
    recall: Number(metrics.recall_high_risk || 0),
    auc: Number(metrics.roc_auc || 0),
    riskLabel: risk?.risk_label || undefined,
    riskProbability: risk?.risk_probability,
  };
}

export default function MLScreen() {
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const [clusters, setClusters] = useState<ClusterUser[]>([]);
  const [adminInsights, setAdminInsights] = useState<AdminInsights | null>(null);
  const [userInsights, setUserInsights] = useState<UserInsights | null>(null);
  const [kValue, setKValue] = useState("3");
  const [usersCount, setUsersCount] = useState("120");
  const [monthsCount, setMonthsCount] = useState("6");
  const [datasetStatus, setDatasetStatus] = useState("");
  const [pipelineStatus, setPipelineStatus] = useState("");
  const [pipelineSummary, setPipelineSummary] = useState<PipelineSummary | null>(null);
  const [proofVisible, setProofVisible] = useState(false);
  const [proofLoading, setProofLoading] = useState(false);
  const [proofSnapshot, setProofSnapshot] = useState<ProofSnapshot | null>(null);
  const [myRisk, setMyRisk] = useState<UserRisk | null>(null);
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError("");

        if (user?.is_admin) {
          const [clusterData, adminData, latestReport] = await Promise.all([
            mlService.getUserClusters(Number(kValue)),
            mlService.getAdminInsights(),
            mlService.getLatestCrispMLQReport(),
          ]);
          if (Array.isArray(clusterData)) {
            setClusters(clusterData);
          } else {
            setClusters([]);
            const clusterPayload = clusterData as { detail?: string };
            const detail =
              typeof clusterData === "object" && clusterData && "detail" in clusterData
                ? String(clusterPayload.detail || "No hay suficientes datos para clusterizar.")
                : "No hay suficientes datos para clusterizar.";
            setPipelineStatus(detail);
          }
          setAdminInsights(adminData);
          const snapshot = buildProofSnapshot(latestReport as Record<string, unknown>, myRisk);
          if (snapshot) {
            setProofSnapshot(snapshot);
          }
          setUserInsights(null);
        } else {
          const [myData, riskData] = await Promise.all([
            mlService.getMyInsights(),
            mlService.getMyRisk(),
          ]);
          setUserInsights(myData);
          setMyRisk(riskData);
          setClusters([]);
          setAdminInsights(null);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No fue posible consultar los datos de IA."
        );
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadData();
    } else {
      setLoading(false);
      setError("Debes iniciar sesion para ver esta seccion.");
    }
  }, [kValue, user]);

  const handleGenerateDataset = async () => {
    try {
      setDatasetStatus("Generando dataset sintetico...");
      const response = await mlService.generateSyntheticDataset({
        users_count: Number(usersCount),
        months: Number(monthsCount),
        seed: 42,
      });
      setDatasetStatus(`Generado: ${response.rows_generated} filas sinteticas.`);
    } catch (err) {
      setDatasetStatus(
        err instanceof Error
          ? `Error al generar dataset: ${err.message}`
          : "Error al generar dataset sintetico."
      );
    }
  };

  const handleRunCrispMLQ = async () => {
    try {
      setPipelineStatus("Ejecutando CRISP-ML(Q)...");
      setPipelineSummary(null);
      const response = await mlService.runCrispMLQPipeline({
        include_synthetic: true,
        synthetic_users: Number(usersCount),
        synthetic_months: Number(monthsCount),
        seed: 42,
      });

      const phases = (response.phases || []) as Array<Record<string, unknown>>;
      const dataEngineering = phases.find((phase) => phase.phase === "data_engineering");
      const modelEvaluation = phases.find((phase) => phase.phase === "model_evaluation");

      const qa = (dataEngineering?.qa || {}) as Record<string, number>;
      const metrics = (modelEvaluation?.metrics || {}) as Record<string, number>;
      const summary: PipelineSummary = {
        runId: String(response.run_id || "N/A"),
        modelVersion: String(response.deployment?.model_version || "N/A"),
        combinedRows: Number(qa.combined_rows || 0),
        preparedRows: Number(qa.prepared_rows || 0),
        syntheticRows: Number(qa.synthetic_rows || 0),
        f1: Number(metrics.f1 || 0),
        recall: Number(metrics.recall_high_risk || 0),
        auc: Number(metrics.roc_auc || 0),
      };

      setPipelineSummary(summary);
      const snapshot = buildProofSnapshot(
        response as unknown as Record<string, unknown>,
        myRisk
      );
      if (snapshot) {
        setProofSnapshot(snapshot);
        setProofVisible(true);
      }
      setPipelineStatus(
        response.deployment.deployed
          ? `Pipeline OK. Modelo ${response.deployment.model_version || "sin-version"} desplegado.`
          : "Pipeline ejecutado, pero no se desplego (fallo algun quality gate)."
      );
    } catch (err) {
      setPipelineStatus(
        err instanceof Error
          ? `Error en CRISP-ML(Q): ${err.message}`
          : "Error ejecutando CRISP-ML(Q)."
      );
    }
  };

  const handleOpenProofModal = async () => {
    try {
      setProofLoading(true);
      const [latestReport, latestRisk] = await Promise.all([
        mlService.getLatestCrispMLQReport(),
        mlService.getMyRisk().catch(() => null),
      ]);
      const snapshot = buildProofSnapshot(
        latestReport as Record<string, unknown>,
        latestRisk
      );

      if (!snapshot) {
        setPipelineStatus("Aun no hay corrida valida. Ejecuta Entrenar con CRISP-ML(Q).");
        return;
      }

      setProofSnapshot(snapshot);
      setProofVisible(true);
    } catch (err) {
      setPipelineStatus(
        err instanceof Error
          ? `No fue posible cargar evidencia: ${err.message}`
          : "No fue posible cargar evidencia del modelo."
      );
    } finally {
      setProofLoading(false);
    }
  };

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
  const adminAnalysisText = composeAnalysisText(
    adminInsights?.conclusions,
    adminInsights?.suggestions
  );
  const userAnalysisText = composeAnalysisText(
    userInsights?.conclusions,
    userInsights?.suggestions
  );

  const handleAskFinancialAssistant = async () => {
    const question = chatQuestion.trim();
    if (!question) {
      return;
    }

    const nextMessages: ChatMessage[] = [...chatMessages, { role: "user", text: question }];
    setChatMessages(nextMessages);
    setChatQuestion("");
    setChatLoading(true);

    try {
      const response = await mlService.askFinancialAssistant({ question });
      setChatMessages([
        ...nextMessages,
        { role: "assistant", text: response.answer },
      ]);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "No fue posible obtener respuesta del asistente financiero.";
      setChatMessages([
        ...nextMessages,
        { role: "assistant", text: message },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.headerCard} mode="contained">
        <Card.Content>
          <Text variant="headlineSmall" style={styles.title}>
            EcoFinance Intelligence
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            {user?.is_admin
              ? "Vista admin: clusters, patrones globales, comparacion macro y conclusiones accionables."
              : "Vista usuario: tus habitos, riesgo de gasto y sugerencias personalizadas."}
          </Text>

          <Button mode="contained-tonal" onPress={handleOpenProofModal}>
            Ver evidencia IA (beta)
          </Button>

          {user?.is_admin ? (
            <>
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

              <Text variant="titleSmall" style={styles.sectionTitle}>
                Dataset sintetico para entrenamiento inicial
              </Text>
              <View style={styles.syntheticControls}>
                <SegmentedButtons
                  value={usersCount}
                  onValueChange={setUsersCount}
                  buttons={[
                    { value: "120", label: "120 users" },
                    { value: "300", label: "300 users" },
                    { value: "600", label: "600 users" },
                  ]}
                  style={styles.segmentedSmall}
                />
                <SegmentedButtons
                  value={monthsCount}
                  onValueChange={setMonthsCount}
                  buttons={[
                    { value: "6", label: "6m" },
                    { value: "24", label: "24m" },
                    { value: "48", label: "48m" },
                    { value: "12", label: "12m" },
                  ]}
                  style={styles.segmentedSmall}
                />
                <Button mode="contained" onPress={handleGenerateDataset}>
                  Generar dataset
                </Button>
                <Button mode="outlined" onPress={handleRunCrispMLQ}>
                  Entrenar con CRISP-ML(Q)
                </Button>
                <Button
                  mode="text"
                  onPress={() => {
                    setUsersCount("120");
                    setMonthsCount("6");
                  }}
                >
                  Usar modo 10k+ datos
                </Button>
                {datasetStatus ? <Text style={styles.infoText}>{datasetStatus}</Text> : null}
                {pipelineStatus ? <Text style={styles.infoText}>{pipelineStatus}</Text> : null}
                {pipelineSummary ? (
                  <View style={styles.kpisRow}>
                    <Chip style={styles.kpiChip}>Run {pipelineSummary.runId}</Chip>
                    <Chip style={styles.kpiChip}>Modelo {pipelineSummary.modelVersion}</Chip>
                    <Chip style={styles.kpiChip}>Filas combinadas: {pipelineSummary.combinedRows}</Chip>
                    <Chip style={styles.kpiChip}>Filas preparadas: {pipelineSummary.preparedRows}</Chip>
                    <Chip style={styles.kpiChip}>Filas sinteticas: {pipelineSummary.syntheticRows}</Chip>
                    <Chip style={styles.kpiChip}>F1: {pipelineSummary.f1.toFixed(4)}</Chip>
                    <Chip style={styles.kpiChip}>Recall: {pipelineSummary.recall.toFixed(4)}</Chip>
                    <Chip style={styles.kpiChip}>AUC: {pipelineSummary.auc.toFixed(4)}</Chip>
                  </View>
                ) : null}
              </View>

              {!loading && !error ? (
                <View style={styles.kpisRow}>
                  <Chip style={styles.kpiChip}>{clusters.length} usuarios clusterizados</Chip>
                  <Chip style={styles.kpiChip}>{groupedData.length} clusters</Chip>
                  {adminInsights ? (
                    <>
                      <Chip style={styles.kpiChip}>{adminInsights.percent_investors}% invierten</Chip>
                      <Chip style={styles.kpiChip}>{adminInsights.percent_savers}% balance positivo</Chip>
                    </>
                  ) : null}
                </View>
              ) : null}
            </>
          ) : null}
        </Card.Content>
      </Card>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.infoText}>Cargando datos del modelo...</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {!loading && !error ? (
        <>
          {user?.is_admin ? (
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
                <Card style={styles.itemCard} mode="contained">
                  <Card.Content>
                    <Text variant="titleMedium" style={styles.itemTitle}>
                      Analisis unificado
                    </Text>
                    <Text style={styles.itemText}>{adminAnalysisText}</Text>
                  </Card.Content>
                </Card>
              </View>
            </View>
          ) : (
            <View style={styles.listContainer}>
              <Card style={styles.itemCard} mode="contained">
                <Card.Content>
                  <Text variant="titleMedium" style={styles.itemTitle}>
                    Ratio gasto/ingreso
                  </Text>
                  <Text style={styles.itemText}>
                    {Math.round((userInsights?.spending_vs_income_ratio || 0) * 100)}%
                  </Text>
                  <Text style={styles.itemText}>
                    Ahorro sugerido (15%): ${userInsights?.recommended_saving_amount || 0}
                  </Text>
                  <Text style={styles.itemText}>
                    Riesgo IA: {myRisk?.risk_label || "no disponible"}
                    {typeof myRisk?.risk_probability === "number"
                      ? ` (${Math.round(myRisk.risk_probability * 100)}%)`
                      : ""}
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.itemCard} mode="contained">
                <Card.Content>
                  <Text variant="titleMedium" style={styles.itemTitle}>
                    Analisis unificado
                  </Text>
                  <Text style={styles.itemText}>{userAnalysisText}</Text>
                </Card.Content>
              </Card>
            </View>
          )}

          <Card style={[styles.itemCard, styles.chatCard]} mode="contained">
            <Card.Content>
              <Text variant="titleMedium" style={styles.itemTitle}>
                Chat IA financiera (beta)
              </Text>
              <Text style={styles.chatIntroText}>
                Preguntas sugeridas: "Como puedo ahorrar?", "Cual es mi categoria con mas gastos?", "Que porcentaje de mi sueldo he gastado?"
              </Text>

              <View style={styles.chatPanel}>
              <View style={styles.chatMessagesWrap}>
                {chatMessages.length ? (
                  chatMessages.map((msg, index) => (
                    <View
                      key={`${msg.role}-${index}`}
                      style={[
                        styles.chatBubble,
                        msg.role === "user" ? styles.chatBubbleUser : styles.chatBubbleAssistant,
                      ]}
                    >
                      <Text style={styles.chatBubbleText}>{msg.text}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.chatEmptyText}>
                    Aun no hay preguntas. Escribe una consulta para iniciar.
                  </Text>
                )}
              </View>
              </View>

              <TextInput
                mode="outlined"
                label="Escribe tu pregunta"
                value={chatQuestion}
                onChangeText={setChatQuestion}
                multiline
                contentStyle={styles.chatInputText}
                style={styles.chatInput}
                returnKeyType="send"
                submitBehavior="submit"
                onSubmitEditing={() => void handleAskFinancialAssistant()}
              />
              <Button
                mode="contained"
                onPress={handleAskFinancialAssistant}
                loading={chatLoading}
                disabled={chatLoading || !chatQuestion.trim()}
                style={styles.chatButton}
              >
                Preguntar a la IA
              </Button>
            </Card.Content>
          </Card>
        </>
      ) : null}
    </ScrollView>
    <Portal>
      <Dialog visible={proofVisible} onDismiss={() => setProofVisible(false)} style={styles.proofDialog}>
        <Dialog.Title>Evidencia IA (beta)</Dialog.Title>
        <Dialog.Content>
          {proofLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.infoText}>Cargando evidencia...</Text>
            </View>
          ) : proofSnapshot ? (
            <View style={styles.proofContent}>
              <Text style={styles.proofLine}>Run ID: {proofSnapshot.runId}</Text>
              <Text style={styles.proofLine}>Fecha: {proofSnapshot.executedAt}</Text>
              <Text style={styles.proofLine}>Version modelo: {proofSnapshot.modelVersion}</Text>
              <Text style={styles.proofLine}>Modelo seleccionado: {proofSnapshot.selectedModel}</Text>
              <Text style={styles.proofLine}>Validacion: {proofSnapshot.splitStrategy}</Text>
              <Text style={styles.proofLine}>Filas combinadas: {proofSnapshot.combinedRows}</Text>
              <Text style={styles.proofLine}>Filas preparadas: {proofSnapshot.preparedRows}</Text>
              <Text style={styles.proofLine}>Filas sinteticas: {proofSnapshot.syntheticRows}</Text>
              <Text style={styles.proofLine}>F1: {proofSnapshot.f1.toFixed(4)}</Text>
              <Text style={styles.proofLine}>Recall alto riesgo: {proofSnapshot.recall.toFixed(4)}</Text>
              <Text style={styles.proofLine}>AUC: {proofSnapshot.auc.toFixed(4)}</Text>
              <Text style={styles.proofLine}>
                Riesgo actual: {proofSnapshot.riskLabel || "no disponible"}
                {typeof proofSnapshot.riskProbability === "number"
                  ? ` (${Math.round(proofSnapshot.riskProbability * 100)}%)`
                  : ""}
              </Text>
            </View>
          ) : (
            <Text style={styles.infoText}>
              Aun no hay evidencia disponible. Ejecuta Entrenar con CRISP-ML(Q).
            </Text>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setProofVisible(false)}>Cerrar</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
    </>
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
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  syntheticControls: {
    marginTop: 12,
    gap: 8,
  },
  segmentedSmall: {
    maxWidth: 520,
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
  chatCard: {
    width: "100%",
    alignSelf: "stretch",
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
  proofDialog: {
    backgroundColor: Colors.surface,
  },
  proofContent: {
    gap: 6,
  },
  proofLine: {
    color: Colors.textSecondary,
  },
  chatPanel: {
    marginTop: 8,
    marginBottom: 12,
    minHeight: 320,
    width: "100%",
    backgroundColor: "#F6FAF7",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  chatMessagesWrap: {
    flex: 1,
    width: "100%",
    gap: 8,
  },
  chatIntroText: {
    color: Colors.textSecondary,
    marginBottom: 6,
    fontSize: 17,
    lineHeight: 24,
  },
  chatEmptyText: {
    color: Colors.textSecondary,
    marginBottom: 4,
    fontSize: 17,
    lineHeight: 24,
  },
  chatBubble: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chatBubbleUser: {
    backgroundColor: "#EAF2FB",
    alignSelf: "flex-end",
    maxWidth: "94%",
  },
  chatBubbleAssistant: {
    backgroundColor: "#E8F4EC",
    alignSelf: "flex-start",
    width: "100%",
    maxWidth: "100%",
  },
  chatBubbleText: {
    color: Colors.textPrimary,
    fontSize: 18,
    lineHeight: 26,
  },
  chatButton: {
    marginTop: 10,
    alignSelf: "flex-start",
  },
  chatInput: {
    width: "100%",
  },
  chatInputText: {
    fontSize: 17,
    lineHeight: 24,
    minHeight: 88,
  },
});
