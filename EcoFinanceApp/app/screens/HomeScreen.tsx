import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  Avatar,
  Card,
  Chip,
  Divider,
  Menu,
  Text,
  TextInput,
} from "react-native-paper";
import ButtonCustom from "../components/ButtonCustom";
import { D3BarChart } from "../components/D3Charts";
import ExpenseCard from "../components/ExpenseCard";
import {
  QuickDockButton,
  SidebarItem,
  SurfaceStat,
} from "../components/HomeScreenParts";
import { Colors } from "../constants/Colors";
import { useAuth } from "../hooks/useAuth";
import { currencyOptions, useCurrency } from "../hooks/useCurrency";
import { expenseService, Expense, User, mlService, userService } from "../services/api";
import { RootStackParamList } from "../navigation/AppNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Home">;

interface UserExpenseGroup {
  user: User;
  expenses: Expense[];
}

interface AssistantMessage {
  role: "user" | "assistant";
  text: string;
}

const sumAmounts = (expenses: Expense[], movementType: Expense["movement_type"]) =>
  expenses
    .filter((item) => item.movement_type === movementType)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

const calculateInvestmentProjection = (expenses: Expense[]) =>
  expenses
    .filter(
      (item) =>
        item.movement_type === "investment" &&
        item.expected_return_rate &&
        Number(item.expected_return_rate) > 0
    )
    .reduce((sum, item) => {
      const rate = Number(item.expected_return_rate || 0) / 100;
      return sum + Number(item.amount || 0) * rate;
    }, 0);

const normalizeIncomeToMonthly = (amount?: number | null, frequency?: string | null) => {
  if (!amount || amount <= 0) {
    return 0;
  }

  if (frequency === "weekly") {
    return amount * 4;
  }

  if (frequency === "biweekly") {
    return amount * 2;
  }

  return amount;
};

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NavigationProp>();
  const { user, signOut } = useAuth();
  const { currency, setCurrencyCode, formatCurrency } = useCurrency();
  const [groups, setGroups] = useState<UserExpenseGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [currencyMenuVisible, setCurrencyMenuVisible] = useState(false);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [assistantVisible, setAssistantVisible] = useState(false);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantAnalysisText, setAssistantAnalysisText] = useState("");
  const [assistantAnalysisExpanded, setAssistantAnalysisExpanded] = useState(true);
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [assistantSuggestedQuestions, setAssistantSuggestedQuestions] = useState<string[]>([
    "Como puedo ahorrar este mes?",
    "Cual es mi categoria con mas gastos?",
    "Que porcentaje de mi sueldo he gastado?",
    "Como puedo empezar a invertir de forma segura?",
  ]);
  const sidebarTranslate = useRef(new Animated.Value(-320)).current;
  const sidebarOpacity = useRef(new Animated.Value(0)).current;
  const hoverCloseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCompact = width < 640;
  const isLargeScreen = width >= 980;
  const sidebarWidth = Math.min(310, Math.max(250, width * 0.8));
  const chartWidth = Math.max(
    220,
    Math.min(width - (isCompact ? 56 : 72), isLargeScreen ? 500 : 360)
  );

  const clearCloseTimeout = () => {
    if (hoverCloseTimeout.current) {
      clearTimeout(hoverCloseTimeout.current);
      hoverCloseTimeout.current = null;
    }
  };

  const openDashboard = () => {
    clearCloseTimeout();
    setProfileMenuVisible(true);
  };

  const closeDashboard = () => {
    clearCloseTimeout();
    setProfileMenuVisible(false);
  };

  const scheduleCloseDashboard = () => {
    if (Platform.OS !== "web") {
      return;
    }

    clearCloseTimeout();
    hoverCloseTimeout.current = setTimeout(() => {
      setProfileMenuVisible(false);
    }, 180);
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(sidebarTranslate, {
        toValue: profileMenuVisible ? 0 : -(sidebarWidth + 24),
        duration: profileMenuVisible ? 260 : 220,
        useNativeDriver: true,
      }),
      Animated.timing(sidebarOpacity, {
        toValue: profileMenuVisible ? 1 : 0,
        duration: profileMenuVisible ? 220 : 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [profileMenuVisible, sidebarOpacity, sidebarTranslate, sidebarWidth]);

  useEffect(() => {
    return () => {
      clearCloseTimeout();
    };
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => null,
      headerLeft: () => (
        <View style={styles.headerLeftGroup}>
          <Pressable
            onPress={() => setProfileMenuVisible((current) => !current)}
            onHoverIn={() => {
              if (Platform.OS === "web") {
                openDashboard();
              }
            }}
            onHoverOut={() => {
              if (Platform.OS === "web") {
                scheduleCloseDashboard();
              }
            }}
            style={styles.headerMenuButton}
          >
            <View style={styles.headerMenuLine} />
            <View style={styles.headerMenuLine} />
            <View style={styles.headerMenuLine} />
          </Pressable>

          <View style={styles.headerBrand}>
            <View style={styles.headerBrandBadge}>
              <Text style={styles.headerBrandBadgeText}>EF</Text>
            </View>
            <View>
              <Text style={styles.headerBrandTitle}>EcoFinance Intelligence</Text>
            </View>
          </View>
        </View>
      ),
      headerRight: () => <View />,
      headerShadowVisible: false,
    });
  }, [navigation]);

  const loadDashboard = useCallback(async () => {
    if (!user) {
      setGroups([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setError("");
      const users = user.is_admin ? await userService.getUsers() : [user];
      const expensesByUser = await Promise.all(
        users.map(async (item) => ({
          user: item,
          expenses: await expenseService.getExpensesByUser(item.id),
        }))
      );

      setGroups(expensesByUser);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No fue posible cargar el inicio."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadDashboard();
    }, [loadDashboard])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
  };

  const buildSingleAnalysisText = (payload: {
    conclusions?: string[];
    suggestions?: string[];
  }) => {
    const conclusions = (payload.conclusions || []).filter(Boolean).join(" ").trim();
    const suggestions = (payload.suggestions || []).filter(Boolean).join(" ").trim();
    if (conclusions && suggestions) {
      return `${conclusions} ${suggestions}`.trim();
    }
    return (conclusions || suggestions || "Aun no hay analisis disponible.").trim();
  };

  const openAssistant = async () => {
    setAssistantVisible(true);
    setAssistantLoading(true);
    try {
      if (user?.is_admin) {
        const insights = await mlService.getAdminInsights();
        setAssistantAnalysisText(
          buildSingleAnalysisText({
            conclusions: insights.conclusions,
            suggestions: insights.suggestions,
          })
        );
      } else {
        const insights = await mlService.getMyInsights();
        setAssistantAnalysisText(
          buildSingleAnalysisText({
            conclusions: insights.conclusions,
            suggestions: insights.suggestions,
          })
        );
      }

      if (!assistantMessages.length) {
        setAssistantMessages([
          {
            role: "assistant",
            text:
              "Hola, soy tu asistente financiero. Puedes preguntarme por ahorro, inversion, categoria de mayor gasto y porcentaje de sueldo gastado.",
          },
        ]);
      }
    } catch (err) {
      setAssistantAnalysisText(
        err instanceof Error
          ? `No pude cargar el analisis ahora: ${err.message}`
          : "No pude cargar el analisis en este momento."
      );
    } finally {
      setAssistantLoading(false);
    }
  };

  const askAssistant = async (rawQuestion?: string) => {
    const question = (rawQuestion || assistantQuestion).trim();
    if (!question || !user) {
      return;
    }

    const currentMessages = [...assistantMessages, { role: "user", text: question } as AssistantMessage];
    setAssistantMessages(currentMessages);
    setAssistantQuestion("");
    setAssistantLoading(true);

    try {
      const response = await mlService.askFinancialAssistant({ question, target_user_id: user.id });
      setAssistantMessages([
        ...currentMessages,
        { role: "assistant", text: response.answer },
      ]);
      if (response.suggested_questions?.length) {
        setAssistantSuggestedQuestions(response.suggested_questions);
      }
    } catch (err) {
      setAssistantMessages([
        ...currentMessages,
        {
          role: "assistant",
          text:
            err instanceof Error
              ? err.message
              : "No pude responder en este momento. Intenta nuevamente.",
        },
      ]);
    } finally {
      setAssistantLoading(false);
    }
  };

  const totalUsers = groups.length;
  const groupedSummaries = groups.map((group) => {
    const recurringIncome = normalizeIncomeToMonthly(
      group.user.base_income,
      group.user.income_frequency
    );
    const extraIncome = sumAmounts(group.expenses, "income");
    const expensesTotal = sumAmounts(group.expenses, "expense");
    const investmentsTotal = sumAmounts(group.expenses, "investment");
    const projectedMonthlyReturn = calculateInvestmentProjection(
      group.expenses.filter(
        (item) => item.expected_return_frequency !== "annual"
      )
    );
    const projectedAnnualReturn = calculateInvestmentProjection(
      group.expenses.filter(
        (item) => item.expected_return_frequency === "annual"
      )
    );

    return {
      user: group.user,
      expenses: group.expenses,
      recurringIncome,
      extraIncome,
      expensesTotal,
      investmentsTotal,
      projectedMonthlyReturn,
      projectedAnnualReturn,
      availableBalance:
        recurringIncome + extraIncome - expensesTotal - investmentsTotal,
    };
  });

  const totalMovements = groups.reduce((sum, group) => sum + group.expenses.length, 0);
  const totalRecurringIncome = groupedSummaries.reduce(
    (sum, group) => sum + group.recurringIncome,
    0
  );
  const totalExtraIncome = groupedSummaries.reduce(
    (sum, group) => sum + group.extraIncome,
    0
  );
  const totalExpensesAmount = groupedSummaries.reduce(
    (sum, group) => sum + group.expensesTotal,
    0
  );
  const totalInvestmentsAmount = groupedSummaries.reduce(
    (sum, group) => sum + group.investmentsTotal,
    0
  );
  const totalProjectedMonthlyReturn = groupedSummaries.reduce(
    (sum, group) => sum + group.projectedMonthlyReturn,
    0
  );
  const totalProjectedAnnualReturn = groupedSummaries.reduce(
    (sum, group) => sum + group.projectedAnnualReturn,
    0
  );
  const totalAvailableBalance =
    totalRecurringIncome +
    totalExtraIncome -
    totalExpensesAmount -
    totalInvestmentsAmount;
  const summaryStats = [
    {
      label: user?.is_admin ? "Usuarios activos" : "Tu perfil",
      value: user?.is_admin ? String(totalUsers) : "Personal",
    },
    {
      label: "Ingresos totales",
      value: formatCurrency(totalRecurringIncome + totalExtraIncome),
    },
    {
      label: "Balance disponible",
      value: formatCurrency(totalAvailableBalance),
    },
    {
      label: "Ganancia estimada/mes",
      value: formatCurrency(totalProjectedMonthlyReturn),
    },
    {
      label: "Ganancia estimada/año",
      value: formatCurrency(totalProjectedAnnualReturn),
    },
  ];
  const quickActions: React.ComponentProps<typeof QuickDockButton>[] = [
    {
      icon: "view-dashboard-outline",
      onPress: () => navigation.navigate("Home"),
    },
    {
      icon: "history",
      onPress: () => navigation.navigate("History"),
    },
    {
      icon: "cash-plus",
      onPress: () => navigation.navigate("Expense"),
    },
  ];
  const totalsByUser = groupedSummaries.map((group) => ({
    label: group.user.name.split(" ")[0].slice(0, 6) || `U${group.user.id}`,
    total: group.availableBalance,
  }));

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          isCompact ? styles.contentCompact : null,
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Card style={styles.welcomeCard} mode="contained">
          <Card.Content>
            <View style={[styles.heroGrid, isLargeScreen ? styles.heroGridLarge : null]}>
              <View style={styles.heroMain}>
                <Text variant="headlineSmall" style={styles.welcomeTitle}>
                  Hola, {user?.firstName || user?.name || "usuario"}
                </Text>
                <Text variant="bodyLarge" style={styles.welcomeSubtitle}>
                  Gestiona ingresos, gastos e inversiones con una vista más real de
                  tu dinero disponible y del comportamiento financiero.
                </Text>

                <View style={styles.chipRow}>
                  <Chip style={styles.heroChip} textStyle={styles.heroChipText}>
                    {totalUsers} usuarios
                  </Chip>
                  <Chip style={styles.heroChip} textStyle={styles.heroChipText}>
                    {totalMovements} movimientos
                  </Chip>
                  <Chip style={styles.heroChip} textStyle={styles.heroChipText}>
                    Disponible: {formatCurrency(totalAvailableBalance)}
                  </Chip>
                  <Chip style={styles.heroChip} textStyle={styles.heroChipText}>
                    Invertido: {formatCurrency(totalInvestmentsAmount)}
                  </Chip>
                </View>

                <View style={styles.topControls}>
                  <Menu
                    visible={currencyMenuVisible}
                    onDismiss={() => setCurrencyMenuVisible(false)}
                    anchor={
                      <View style={styles.topControlButton}>
                        <ButtonCustom
                          label={`Moneda: ${currency.code}`}
                          onPress={() => setCurrencyMenuVisible(true)}
                          mode="outlined"
                          icon="currency-usd"
                        />
                      </View>
                    }
                  >
                    {currencyOptions.map((option) => (
                      <Menu.Item
                        key={option.code}
                        title={`${option.code} · ${option.label}`}
                        onPress={async () => {
                          await setCurrencyCode(option.code);
                          setCurrencyMenuVisible(false);
                        }}
                      />
                    ))}
                  </Menu>
                </View>

                <View style={styles.actionsRow}>
                  <View style={styles.actionButton}>
                    <ButtonCustom
                      label="Nuevo gasto"
                      onPress={() => navigation.navigate("Expense")}
                      icon="cash-plus"
                    />
                  </View>
                  {user?.is_admin ? (
                    <View style={styles.actionButton}>
                      <ButtonCustom
                        label="Ver ML"
                        onPress={() => void openAssistant()}
                        mode="outlined"
                        icon="chart-bubble"
                      />
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.summaryPanel}>
                {summaryStats.map((item) => (
                  <SurfaceStat key={item.label} label={item.label} value={item.value} />
                ))}
              </View>
            </View>
          </Card.Content>
        </Card>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {loading ? (
          <Text style={styles.loadingText}>Cargando usuarios y gastos...</Text>
        ) : null}

        {!loading && !error && totalsByUser.length ? (
          <Card style={styles.chartCard} mode="contained">
            <Card.Content>
              <Text variant="titleMedium" style={styles.chartTitle}>
                {user?.is_admin
                  ? "Balance disponible por usuario"
                  : "Tu balance disponible"}
              </Text>
              <Text style={styles.chartSubtitle}>
                {user?.is_admin
                  ? "Vista rápida para identificar qué usuarios tienen mayor margen financiero."
                  : "Resumen visual entre ingresos, gastos e inversiones."}
              </Text>
              <D3BarChart
                data={totalsByUser.map((item) => ({
                  label: item.label,
                  value: item.total || 0,
                }))}
                width={chartWidth}
                height={240}
                valuePrefix={currency.code}
                formatValue={formatCurrency}
              />
            </Card.Content>
          </Card>
        ) : null}

        <View style={isLargeScreen ? styles.groupsGrid : null}>
          {groupedSummaries.map((group) => (
            <Card key={group.user.id} style={styles.userCard} mode="contained">
              <Card.Content>
                <View style={styles.userHeader}>
                  <View style={styles.userIdentity}>
                    <Avatar.Text
                      size={44}
                      label={(group.user.name || "U").slice(0, 2).toUpperCase()}
                      style={styles.avatar}
                    />
                    <View>
                      <Text variant="titleMedium" style={styles.userName}>
                        {group.user.name}
                      </Text>
                  <Text
                    variant="bodyMedium"
                    numberOfLines={1}
                    style={styles.userEmail}
                  >
                    {group.user.email}
                  </Text>
                </View>
                  </View>
                  <Text variant="titleSmall" style={styles.totalText}>
                    Disponible: {formatCurrency(group.availableBalance)}
                  </Text>
                </View>

                <View style={styles.summaryMetrics}>
                  <Chip style={styles.metricChip} textStyle={styles.metricChipText}>
                    Base: {formatCurrency(group.recurringIncome)}
                  </Chip>
                  <Chip style={styles.metricChip} textStyle={styles.metricChipText}>
                    Extra: {formatCurrency(group.extraIncome)}
                  </Chip>
                  <Chip style={styles.metricChip} textStyle={styles.metricChipText}>
                    Gastos: {formatCurrency(group.expensesTotal)}
                  </Chip>
                  <Chip style={styles.metricChip} textStyle={styles.metricChipText}>
                    Inversión: {formatCurrency(group.investmentsTotal)}
                  </Chip>
                  <Chip style={styles.metricChip} textStyle={styles.metricChipText}>
                    Gana/mes: {formatCurrency(group.projectedMonthlyReturn)}
                  </Chip>
                  <Chip style={styles.metricChip} textStyle={styles.metricChipText}>
                    Gana/año: {formatCurrency(group.projectedAnnualReturn)}
                  </Chip>
                </View>

                <Divider style={styles.divider} />

                {group.expenses.length ? (
                  group.expenses.map((expense) => (
                    <ExpenseCard key={expense.id} expense={expense} />
                  ))
                ) : (
                  <Text style={styles.emptyText}>
                    Este usuario aun no tiene gastos registrados.
                  </Text>
                )}
              </Card.Content>
            </Card>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.mlFloatingButton}
        onPress={openAssistant}
      >
        <Text style={styles.mlFloatingButtonText}>IA Financiera</Text>
      </TouchableOpacity>

      {assistantVisible ? (
        <View
          style={[
            styles.assistantFloatingPanel,
            isCompact
              ? styles.assistantFloatingPanelCompact
              : styles.assistantFloatingPanelDesktop,
          ]}
        >
          <View style={styles.assistantPanelHeader}>
            <View style={styles.assistantPanelTitleWrap}>
              <Text style={styles.assistantPanelEyebrow}>EcoFinance</Text>
              <Text style={styles.assistantPanelTitle}>Intelligence</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setAssistantVisible(false)}
              style={styles.assistantCloseButton}
            >
              <Text style={styles.assistantCloseButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>

          {assistantLoading ? (
            <View style={styles.assistantLoadingRow}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.assistantHelperText}>Cargando...</Text>
            </View>
          ) : null}

          <View style={styles.assistantAnalysisCard}>
            <View style={styles.assistantAnalysisHeader}>
              <Text style={styles.assistantSectionTitle}>Analisis actual</Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setAssistantAnalysisExpanded((current) => !current)}
                style={styles.assistantAnalysisToggle}
              >
                <Text style={styles.assistantAnalysisToggleText}>
                  {assistantAnalysisExpanded ? "Ocultar" : "Mostrar"}
                </Text>
              </TouchableOpacity>
            </View>
            {assistantAnalysisExpanded ? (
              <ScrollView
                style={styles.assistantAnalysisBody}
                contentContainerStyle={styles.assistantAnalysisBodyContent}
                nestedScrollEnabled
              >
                <Text style={styles.assistantAnalysisText}>
                  {assistantAnalysisText || "Aun no hay analisis disponible."}
                </Text>
              </ScrollView>
            ) : null}
          </View>

          <Text style={styles.assistantSectionTitle}>Chat</Text>
          <View style={styles.assistantChatCard}>
            <ScrollView
              style={[
                styles.assistantMessagesBox,
                assistantAnalysisExpanded
                  ? styles.assistantMessagesBoxWithAnalysis
                  : styles.assistantMessagesBoxExpanded,
              ]}
              contentContainerStyle={styles.assistantMessagesContent}
            >
              {assistantMessages.map((message, index) => (
                <View
                  key={`${message.role}-${index}`}
                  style={[
                    styles.assistantBubble,
                    message.role === "user"
                      ? styles.assistantBubbleUser
                      : styles.assistantBubbleAI,
                  ]}
                >
                  <Text style={styles.assistantBubbleText}>{message.text}</Text>
                </View>
              ))}
            </ScrollView>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.assistantChipsRow}
              contentContainerStyle={styles.assistantChipsContent}
            >
              {assistantSuggestedQuestions.map((question) => (
                <TouchableOpacity
                  key={question}
                  activeOpacity={0.85}
                  onPress={() => {
                    setAssistantQuestion(question);
                    void askAssistant(question);
                  }}
                  style={styles.assistantQuestionChip}
                >
                  <Text style={styles.assistantQuestionChipText}>{question}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.assistantComposer}>
              <View style={styles.assistantComposerBubble}>
                <TextInput
                  mode="flat"
                  placeholder="Preguntale a la IA"
                  value={assistantQuestion}
                  onChangeText={setAssistantQuestion}
                  multiline
                  style={styles.assistantInput}
                  contentStyle={styles.assistantInputText}
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  returnKeyType="send"
                  submitBehavior="submit"
                  onSubmitEditing={() => void askAssistant()}
                />
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.assistantAskButton}
                  onPress={() => void askAssistant()}
                >
                  <Text style={styles.assistantAskButtonText}>Enviar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      <Pressable
        style={[
          styles.leftRailZone,
          profileMenuVisible ? { width: sidebarWidth + 12 } : null,
        ]}
        onHoverIn={() => {
          if (Platform.OS === "web") {
            openDashboard();
          }
        }}
        onHoverOut={() => {
          if (Platform.OS === "web") {
            scheduleCloseDashboard();
          }
        }}
        pointerEvents="box-none"
      >
        {!profileMenuVisible ? (
          <View
            style={[
              styles.quickDock,
              isCompact ? styles.quickDockCompact : null,
            ]}
          >
            {quickActions.map((item) => (
              <QuickDockButton key={item.icon} {...item} />
            ))}
          </View>
        ) : null}

        {profileMenuVisible ? (
          <>
            <Pressable style={styles.sidebarBackdrop} onPress={closeDashboard} />
            <Animated.View
              style={[
                styles.sidebarPanel,
                { width: sidebarWidth },
                {
                  opacity: sidebarOpacity,
                  transform: [{ translateX: sidebarTranslate }],
                },
              ]}
            >
              <View style={styles.sidebarContent}>
                <View style={styles.sidebarHeader}>
                  <TouchableOpacity
                    activeOpacity={0.88}
                    style={styles.sidebarUserCard}
                    onPress={() => {
                      setProfileMenuVisible(false);
                      navigation.navigate("Profile");
                    }}
                  >
                    <View style={styles.sidebarUserRow}>
                      {user?.avatarUri ? (
                        <Avatar.Image
                          size={54}
                          source={{ uri: user.avatarUri }}
                        />
                      ) : (
                        <Avatar.Text
                          size={54}
                          label={(user?.name || "U").slice(0, 2).toUpperCase()}
                          style={styles.sidebarAvatar}
                          labelStyle={styles.sidebarAvatarLabel}
                        />
                      )}
                      <View style={styles.sidebarUserInfo}>
                        <Text style={styles.sidebarUserName}>
                          {user?.firstName || user?.name || "Usuario"}
                        </Text>
                        <Text numberOfLines={1} style={styles.sidebarUserEmail}>
                          {user?.email || "Sin correo"}
                        </Text>
                        <Text style={styles.sidebarUserHint}>
                          Toca la foto o este bloque para abrir tu información
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>

                <SidebarItem
                  icon="view-dashboard-outline"
                  label="Inicio"
                  active
                  onPress={() => setProfileMenuVisible(false)}
                />
                <SidebarItem
                  icon="history"
                  label="Historial"
                  onPress={() => {
                    setProfileMenuVisible(false);
                    navigation.navigate("History");
                  }}
                />
                <SidebarItem
                  icon="brain"
                  label="IA financiera"
                  onPress={() => {
                    setProfileMenuVisible(false);
                    navigation.navigate("ML");
                  }}
                />
                <SidebarItem
                  icon="cash-plus"
                  label="Nuevo gasto"
                  onPress={() => {
                    setProfileMenuVisible(false);
                    navigation.navigate("Expense");
                  }}
                />
                <View style={styles.sidebarSpacer} />
                <View style={styles.sidebarDivider} />
                <View style={styles.sidebarLogoutWrap}>
                  <SidebarItem
                    icon="logout"
                    label="Cerrar sesión"
                    danger
                    onPress={() => {
                      setProfileMenuVisible(false);
                      signOut();
                    }}
                  />
                </View>
              </View>
            </Animated.View>
          </>
        ) : null}
      </Pressable>
    </View>
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
    maxWidth: 1200,
    alignSelf: "center",
    width: "100%",
  },
  contentCompact: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  mlFloatingButton: {
    position: "absolute",
    right: 16,
    bottom: 18,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 14,
    zIndex: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  mlFloatingButtonText: {
    color: Colors.surface,
    fontWeight: "800",
    letterSpacing: 0.3,
    fontSize: 15,
  },
  assistantFloatingPanel: {
    position: "absolute",
    right: 16,
    width: 430,
    maxWidth: "96%",
    backgroundColor: "#F8FBF9",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#D7E5DD",
    padding: 18,
    zIndex: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
    flexDirection: "column",
  },
  assistantFloatingPanelDesktop: {
    top: 88,
    bottom: 88,
  },
  assistantFloatingPanelCompact: {
    top: 72,
    bottom: 74,
    right: 10,
    left: 10,
    width: "auto",
  },
  assistantPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  assistantPanelTitleWrap: {
    flex: 1,
  },
  assistantPanelEyebrow: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  assistantPanelTitle: {
    color: Colors.textPrimary,
    fontWeight: "800",
    fontSize: 26,
    lineHeight: 32,
    flex: 1,
    paddingRight: 12,
  },
  assistantLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  assistantHelperText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  assistantSectionTitle: {
    color: Colors.textPrimary,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 0,
    fontSize: 18,
  },
  assistantAnalysisCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2ECE6",
    maxHeight: 230,
  },
  assistantAnalysisHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  assistantAnalysisToggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#EEF5F1",
  },
  assistantAnalysisToggleText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  assistantAnalysisBody: {
    marginTop: 8,
    maxHeight: 150,
  },
  assistantAnalysisBodyContent: {
    paddingBottom: 2,
  },
  assistantAnalysisText: {
    color: Colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
  assistantChatCard: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2ECE6",
  },
  assistantMessagesBox: {
    flexGrow: 1,
    minHeight: 140,
    marginBottom: 12,
  },
  assistantMessagesBoxWithAnalysis: {
    maxHeight: 210,
  },
  assistantMessagesBoxExpanded: {
    maxHeight: 360,
  },
  assistantMessagesContent: {
    gap: 10,
    paddingBottom: 4,
  },
  assistantBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  assistantBubbleUser: {
    backgroundColor: "#E7F0FB",
    alignSelf: "flex-end",
    maxWidth: "90%",
  },
  assistantBubbleAI: {
    backgroundColor: "#E6F3EA",
    alignSelf: "flex-start",
    maxWidth: "96%",
  },
  assistantBubbleText: {
    color: Colors.textPrimary,
    fontSize: 16,
    lineHeight: 24,
  },
  assistantChipsRow: {
    marginBottom: 12,
    maxHeight: 52,
    flexGrow: 0,
  },
  assistantChipsContent: {
    paddingRight: 8,
  },
  assistantQuestionChip: {
    backgroundColor: "#ECF4EE",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#D7E5DD",
  },
  assistantQuestionChipText: {
    color: Colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  assistantComposer: {
    width: "100%",
  },
  assistantComposerBubble: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    backgroundColor: "#F7FAF8",
    borderWidth: 1,
    borderColor: "#D7E5DD",
    borderRadius: 20,
    padding: 10,
    width: "100%",
  },
  assistantInput: {
    backgroundColor: "transparent",
    flexGrow: 0,
    flex: 1,
    minHeight: 56,
  },
  assistantInputText: {
    fontSize: 15,
    lineHeight: 22,
    minHeight: 56,
    paddingTop: 10,
  },
  assistantAskButton: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
  },
  assistantAskButtonText: {
    color: Colors.surface,
    fontWeight: "700",
    fontSize: 15,
  },
  assistantCloseButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#EEF5F1",
  },
  assistantCloseButtonText: {
    color: Colors.primary,
    fontWeight: "700",
    fontSize: 14,
  },
  welcomeCard: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    marginBottom: 18,
  },
  heroGrid: {
    gap: 18,
  },
  heroGridLarge: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  heroMain: {
    flex: 1.4,
  },
  summaryPanel: {
    flex: 1,
    gap: 12,
    justifyContent: "center",
  },
  welcomeTitle: {
    color: Colors.surface,
    fontWeight: "800",
    marginBottom: 8,
  },
  welcomeSubtitle: {
    color: "#E9F5EF",
    marginBottom: 18,
    lineHeight: 22,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  topControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  topControlButton: {
    minWidth: 180,
    flex: 1,
  },
  headerMenuButton: {
    width: 46,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#EAF2FB",
  },
  headerBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerBrandBadge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
  },
  headerBrandBadgeText: {
    color: Colors.surface,
    fontWeight: "800",
    fontSize: 14,
  },
  headerBrandTitle: {
    color: Colors.textPrimary,
    fontWeight: "800",
    fontSize: 16,
  },
  headerBrandSubtitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: -2,
  },
  headerMenuLine: {
    width: 18,
    height: 2.5,
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  heroChip: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  heroChipText: {
    color: Colors.surface,
  },
  actionButton: {
    flex: 1,
    minWidth: 150,
  },
  errorText: {
    color: Colors.error,
    marginBottom: 12,
  },
  loadingText: {
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    marginBottom: 16,
  },
  chartTitle: {
    color: Colors.textPrimary,
    fontWeight: "700",
    marginBottom: 6,
  },
  chartSubtitle: {
    color: Colors.textSecondary,
    marginBottom: 14,
  },
  userCard: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    marginBottom: 16,
    flex: 1,
    minWidth: 320,
  },
  groupsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  userHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  userIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  avatar: {
    backgroundColor: Colors.accent,
  },
  userName: {
    color: Colors.textPrimary,
    fontWeight: "700",
  },
  userEmail: {
    color: Colors.textSecondary,
    maxWidth: 180,
  },
  totalText: {
    color: Colors.primary,
    fontWeight: "700",
  },
  summaryMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  metricChip: {
    backgroundColor: "#EEF5FB",
  },
  metricChipText: {
    color: Colors.textPrimary,
  },
  divider: {
    marginBottom: 12,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontStyle: "italic",
  },
  sidebarBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(7, 10, 14, 0.36)",
  },
  leftRailZone: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 76,
    zIndex: 4,
  },
  sidebarPanel: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 310,
    backgroundColor: "#0F1720",
    paddingTop: 16,
    paddingBottom: 20,
    justifyContent: "flex-start",
    shadowColor: "#000000",
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 10, height: 0 },
    elevation: 10,
  },
  sidebarContent: {
    flex: 1,
  },
  sidebarHeader: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
    marginBottom: 10,
  },
  sidebarUserCard: {
    backgroundColor: "#162231",
    borderRadius: 16,
    padding: 14,
  },
  sidebarUserRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sidebarUserInfo: {
    flex: 1,
  },
  sidebarAvatar: {
    backgroundColor: Colors.primary,
  },
  sidebarAvatarLabel: {
    color: Colors.surface,
    fontWeight: "800",
  },
  sidebarUserName: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 4,
  },
  sidebarUserEmail: {
    color: "#AAB8C7",
    fontSize: 13,
    marginBottom: 4,
  },
  sidebarUserHint: {
    color: "#7E90A6",
    fontSize: 12,
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginHorizontal: 14,
    marginVertical: 10,
  },
  sidebarSpacer: {
    flex: 1,
    minHeight: 140,
  },
  sidebarLogoutWrap: {
    paddingBottom: 44,
  },
  quickDock: {
    position: "absolute",
    left: 10,
    top: 118,
    gap: 8,
    zIndex: 4,
  },
  quickDockCompact: {
    left: 8,
    top: 104,
  },
});
