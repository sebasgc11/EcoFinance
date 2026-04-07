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
import { BarChart } from "react-native-chart-kit";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Avatar, Card, Chip, Divider, Menu, Text } from "react-native-paper";
import ButtonCustom from "../components/ButtonCustom";
import ExpenseCard from "../components/ExpenseCard";
import { Colors } from "../constants/Colors";
import { useAuth } from "../hooks/useAuth";
import { currencyOptions, useCurrency } from "../hooks/useCurrency";
import { expenseService, Expense, User, userService } from "../services/api";
import { RootStackParamList } from "../navigation/AppNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Home">;

interface UserExpenseGroup {
  user: User;
  expenses: Expense[];
}

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
              <Text style={styles.headerBrandTitle}>EcoFinance</Text>
              <Text style={styles.headerBrandSubtitle}>Dashboard</Text>
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

  const totalUsers = groups.length;
  const groupedSummaries = groups.map((group) => {
    const recurringIncome = normalizeIncomeToMonthly(
      group.user.base_income,
      group.user.income_frequency
    );
    const extraIncome = group.expenses
      .filter((item) => item.movement_type === "income")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const expensesTotal = group.expenses
      .filter((item) => item.movement_type === "expense")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const investmentsTotal = group.expenses
      .filter((item) => item.movement_type === "investment")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      user: group.user,
      expenses: group.expenses,
      recurringIncome,
      extraIncome,
      expensesTotal,
      investmentsTotal,
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
  const totalAvailableBalance =
    totalRecurringIncome +
    totalExtraIncome -
    totalExpensesAmount -
    totalInvestmentsAmount;
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
                        onPress={() => navigation.navigate("ML")}
                        mode="outlined"
                        icon="chart-bubble"
                      />
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.summaryPanel}>
                <SurfaceStat
                  label={user?.is_admin ? "Usuarios activos" : "Tu perfil"}
                  value={user?.is_admin ? String(totalUsers) : "Personal"}
                />
                <SurfaceStat
                  label="Ingresos totales"
                  value={formatCurrency(totalRecurringIncome + totalExtraIncome)}
                />
                <SurfaceStat
                  label="Balance disponible"
                  value={formatCurrency(totalAvailableBalance)}
                />
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
              <BarChart
                data={{
                  labels: totalsByUser.map((item) => item.label),
                  datasets: [{ data: totalsByUser.map((item) => item.total || 0) }],
                }}
                width={chartWidth}
                height={240}
                fromZero
                yAxisLabel={`${currency.code} `}
                yAxisSuffix=""
                showValuesOnTopOfBars
                chartConfig={{
                  backgroundGradientFrom: Colors.surface,
                  backgroundGradientTo: Colors.surface,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(31, 93, 67, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(27, 67, 50, ${opacity})`,
                  fillShadowGradient: Colors.secondary,
                  fillShadowGradientOpacity: 1,
                  barPercentage: 0.58,
                }}
                style={styles.chart}
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
            <QuickDockButton
              icon="view-dashboard-outline"
              onPress={() => navigation.navigate("Home")}
            />
            <QuickDockButton
              icon="history"
              onPress={() => navigation.navigate("History")}
            />
            <QuickDockButton
              icon="cash-plus"
              onPress={() => navigation.navigate("Expense")}
            />
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

function SurfaceStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function SidebarItem({
  icon,
  label,
  active,
  danger,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  active?: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      style={[
        styles.sidebarItem,
        active ? styles.sidebarItemActive : null,
        danger ? styles.sidebarItemDanger : null,
      ]}
    >
      <View
        style={[
          styles.sidebarIconWrap,
          active ? styles.sidebarIconWrapActive : null,
          danger ? styles.sidebarIconWrapDanger : null,
        ]}
      >
        <MaterialCommunityIcons
          name={icon}
          size={23}
          color={danger ? "#FFD8D8" : active ? Colors.surface : "#EAF2FB"}
        />
      </View>
      <Text
        style={[
          styles.sidebarItemText,
          active ? styles.sidebarItemTextActive : null,
          danger ? styles.sidebarItemTextDanger : null,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function QuickDockButton({
  icon,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.quickDockButton}
    >
      <MaterialCommunityIcons name={icon} size={22} color={Colors.primary} />
    </Pressable>
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
  chart: {
    borderRadius: 18,
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
  statCard: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 20,
    padding: 16,
  },
  statLabel: {
    color: "#D9F3E5",
    marginBottom: 6,
  },
  statValue: {
    color: Colors.surface,
    fontSize: 24,
    fontWeight: "800",
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
  sidebarItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginHorizontal: 12,
    borderRadius: 16,
  },
  sidebarItemActive: {
    backgroundColor: "#162231",
  },
  sidebarItemDanger: {
    backgroundColor: "rgba(214, 69, 69, 0.12)",
  },
  sidebarIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#1A2531",
    alignItems: "center",
    justifyContent: "center",
  },
  sidebarIconWrapActive: {
    backgroundColor: Colors.primary,
  },
  sidebarIconWrapDanger: {
    backgroundColor: "rgba(214, 69, 69, 0.18)",
  },
  sidebarItemText: {
    color: "#F3F7FB",
    fontSize: 16,
    fontWeight: "700",
  },
  sidebarItemTextActive: {
    color: "#FFFFFF",
  },
  sidebarItemTextDanger: {
    color: "#FFD8D8",
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
  quickDockButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.86)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F1720",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
});
