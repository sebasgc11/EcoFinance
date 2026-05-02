import React, { useEffect, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { HelperText, IconButton, Menu, Surface, Text, TextInput } from "react-native-paper";
import ButtonCustom from "../components/ButtonCustom";
import { Colors } from "../constants/Colors";
import { useAuth } from "../hooks/useAuth";
import { currencyOptions, useCurrency } from "../hooks/useCurrency";
import {
  Category,
  User,
  categoryService,
  expenseService,
  userService,
} from "../services/api";

const formatDate = (value: Date) => value.toISOString().slice(0, 10);
const movementTypes = [
  { value: "expense", label: "Gasto" },
  { value: "income", label: "Ingreso adicional" },
  { value: "investment", label: "Inversión" },
] as const;
const investmentReturnOptions = [
  { value: "monthly", label: "Mensual" },
  { value: "annual", label: "Anual" },
] as const;

const calculateProjectedReturn = (
  investmentAmount: number,
  ratePercent: number
) => (investmentAmount > 0 && ratePercent > 0 ? investmentAmount * (ratePercent / 100) : 0);

const normalizeAmountInput = (value: string) => value.replace(/\D/g, "");

const formatAmountInput = (value: string) => {
  const digits = normalizeAmountInput(value);

  if (!digits) {
    return "";
  }

  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(Number(digits));
};

const parseAmountInput = (value: string) => {
  const digits = normalizeAmountInput(value);
  return digits ? Number(digits) : NaN;
};

export default function ExpenseScreen() {
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { currency, setCurrencyCode, formatCurrency } = useCurrency();
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [movementType, setMovementType] =
    useState<(typeof movementTypes)[number]["value"]>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expectedReturnRate, setExpectedReturnRate] = useState("");
  const [expectedReturnFrequency, setExpectedReturnFrequency] =
    useState<(typeof investmentReturnOptions)[number]["value"]>("monthly");
  const [date, setDate] = useState(formatDate(new Date()));
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [error, setError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);
  const [userMenuVisible, setUserMenuVisible] = useState(false);
  const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);
  const [currencyMenuVisible, setCurrencyMenuVisible] = useState(false);
  const [movementMenuVisible, setMovementMenuVisible] = useState(false);
  const [returnFrequencyMenuVisible, setReturnFrequencyMenuVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const isCompact = width < 640;
  const isLargeScreen = width >= 980;

  const handleAmountChange = (value: string) => {
    setAmount(formatAmountInput(value));
    if (error) {
      setError("");
    }
  };

  const resetForm = () => {
    setAmount("");
    setDescription("");
    setExpectedReturnRate("");
    setExpectedReturnFrequency("monthly");
    setSelectedCategory(null);
    setMovementType("expense");
    const currentDate = new Date();
    setSelectedDate(currentDate);
    setDate(formatDate(currentDate));
  };

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [usersResponse, categoriesResponse] = await Promise.all([
          user?.is_admin ? userService.getUsers() : Promise.resolve(user ? [user] : []),
          categoryService.getCategories(),
        ]);

        setUsers(usersResponse);
        setCategories(categoriesResponse);
        if (user && !user.is_admin) {
          setSelectedUser(user);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No fue posible cargar usuarios y categorias."
        );
      } finally {
        setLoadingData(false);
      }
    };

    loadOptions();
  }, []);

  const validate = () => {
    if (!selectedUser) {
      return "Selecciona un usuario.";
    }

    if (!selectedCategory) {
      return "Selecciona una categoria.";
    }

    const parsedAmount = parseAmountInput(amount);

    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return "Ingresa un monto valido mayor que cero.";
    }

    if (!description.trim()) {
      return "La descripcion es obligatoria.";
    }

    if (movementType === "investment" && expectedReturnRate) {
      const parsedRate = Number(expectedReturnRate);
      if (Number.isNaN(parsedRate) || parsedRate < 0) {
        return "Ingresa un porcentaje de rentabilidad valido.";
      }
    }

    return "";
  };

  const handleSubmit = async () => {
    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      setError("");

      await expenseService.createExpense({
        user_id: selectedUser!.id,
        category_id: selectedCategory!.id,
        amount: parseAmountInput(amount),
        movement_type: movementType,
        expected_return_rate:
          movementType === "investment" && expectedReturnRate
            ? Number(expectedReturnRate)
            : null,
        expected_return_frequency:
          movementType === "investment" ? expectedReturnFrequency : null,
        description: description.trim(),
        date,
      });

      resetForm();
      Alert.alert("Exito", "El movimiento fue creado correctamente.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No fue posible crear el gasto."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    const cleanName = newCategoryName.trim();

    if (!cleanName) {
      setCategoryError("Escribe un nombre para la categoria.");
      return;
    }

    const exists = categories.some(
      (item) => item.name.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (exists) {
      setCategoryError("Esa categoria ya existe.");
      return;
    }

    try {
      setCreatingCategory(true);
      setCategoryError("");
      const createdCategory = await categoryService.createCategory({
        name: cleanName,
      });

      setCategories((current) => [...current, createdCategory]);
      setSelectedCategory(createdCategory);
      setNewCategoryName("");
      Alert.alert("Exito", "La categoria fue creada correctamente.");
    } catch (err) {
      setCategoryError(
        err instanceof Error
          ? err.message
          : "No fue posible crear la categoria."
      );
    } finally {
      setCreatingCategory(false);
    }
  };

  const customCategories = categories.filter((item) => !item.is_default);

  const performDeleteCategory = async (category: Category) => {
    const previousCategories = categories;
    try {
      setDeletingCategoryId(category.id);
      setCategoryError("");
      await categoryService.deleteCategory(category.id);
      setCategories((current) =>
        current.filter((item) => item.id !== category.id)
      );
      try {
        const refreshed = await categoryService.getCategories();
        setCategories(refreshed);
      } catch {
        // Keep local state if refresh fails.
      }
      if (selectedCategory?.id === category.id) {
        setSelectedCategory(null);
      }
      if (Platform.OS !== "web") {
        Alert.alert("Exito", "La categoria fue eliminada.");
      }
    } catch (err) {
      setCategories(previousCategories);
      const message =
        err instanceof Error
          ? err.message
          : "No fue posible eliminar la categoría.";
      setCategoryError(message);
      Alert.alert("Error", message);
    } finally {
      setDeletingCategoryId(null);
    }
  };

  const handleDeleteCategory = (category: Category) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const accepted = window.confirm(
        `¿Deseas eliminar "${category.name}"?`
      );
      if (!accepted) {
        return;
      }
      void performDeleteCategory(category);
      return;
    }

    Alert.alert(
      "Eliminar categoría",
      `¿Deseas eliminar "${category.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => void performDeleteCategory(category),
        },
      ]
    );
  };

  const handleDateChange = (event: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS !== "ios") {
      setShowDatePicker(false);
    }

    if (event.type === "dismissed" || !value) {
      return;
    }

    setSelectedDate(value);
    setDate(formatDate(value));
  };

  const amountValue = parseAmountInput(amount);
  const returnRateValue = Number(expectedReturnRate);
  const projectedReturn =
    movementType === "investment" &&
    !Number.isNaN(amountValue) &&
    !Number.isNaN(returnRateValue)
      ? calculateProjectedReturn(amountValue, returnRateValue)
      : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Surface
        style={[
          styles.card,
          isLargeScreen ? styles.cardLarge : null,
          isCompact ? styles.cardCompact : null,
        ]}
        elevation={1}
      >
        <Text variant="headlineSmall" style={styles.title}>
          Registrar movimiento financiero
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Registra gastos, ingresos adicionales o inversiones sin mezclar conceptos.
        </Text>

        {!user?.base_income ? (
          <Surface style={styles.noticeCard} elevation={0}>
            <Text style={styles.noticeTitle}>Configura tu ingreso base</Text>
            <Text style={styles.noticeText}>
              Antes de analizar tus finanzas, define en tu perfil cuánto ganas y si ese ingreso es semanal, quincenal o mensual.
            </Text>
          </Surface>
        ) : null}

        <Menu
          visible={currencyMenuVisible}
          onDismiss={() => setCurrencyMenuVisible(false)}
          anchor={
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setCurrencyMenuVisible(true)}
              style={styles.selector}
            >
              <Text style={styles.selectorLabel}>Moneda</Text>
              <Text style={styles.selectorValue}>
                {currency.code} · {currency.label}
              </Text>
            </TouchableOpacity>
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

        {loadingData ? (
          <Text style={styles.loadingText}>Cargando opciones...</Text>
        ) : null}

        {user?.is_admin ? (
          <Menu
            visible={userMenuVisible}
            onDismiss={() => setUserMenuVisible(false)}
            anchor={
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setUserMenuVisible(true)}
                style={styles.selector}
              >
                <Text style={styles.selectorLabel}>Usuario</Text>
                <Text style={styles.selectorValue}>
                  {selectedUser
                    ? `${selectedUser.name} (${selectedUser.email})`
                    : "Selecciona un usuario"}
                </Text>
              </TouchableOpacity>
            }
          >
            {users.map((item) => (
              <Menu.Item
                key={item.id}
                title={`${item.name} (${item.email})`}
                onPress={() => {
                  setSelectedUser(item);
                  setUserMenuVisible(false);
                }}
              />
            ))}
          </Menu>
        ) : (
          <View style={styles.selector}>
            <Text style={styles.selectorLabel}>Usuario</Text>
            <Text style={styles.selectorValue}>
              {selectedUser
                ? `${selectedUser.name} (${selectedUser.email})`
                : "Cargando usuario"}
            </Text>
          </View>
        )}

        <Menu
          visible={movementMenuVisible}
          onDismiss={() => setMovementMenuVisible(false)}
          anchor={
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setMovementMenuVisible(true)}
              style={styles.selector}
            >
              <Text style={styles.selectorLabel}>Tipo de movimiento</Text>
              <Text style={styles.selectorValue}>
                {movementTypes.find((item) => item.value === movementType)?.label}
              </Text>
            </TouchableOpacity>
          }
        >
          {movementTypes.map((item) => (
            <Menu.Item
              key={item.value}
              title={item.label}
              onPress={() => {
                setMovementType(item.value);
                setMovementMenuVisible(false);
              }}
            />
          ))}
        </Menu>

        <Menu
          visible={categoryMenuVisible}
          onDismiss={() => setCategoryMenuVisible(false)}
          anchor={
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setCategoryMenuVisible(true)}
              style={styles.selector}
            >
              <Text style={styles.selectorLabel}>Categoria</Text>
              <Text style={styles.selectorValue}>
                {selectedCategory
                  ? selectedCategory.name
                  : "Selecciona una categoria"}
              </Text>
            </TouchableOpacity>
          }
        >
          {categories.map((item) => (
            <Menu.Item
              key={item.id}
              title={item.name}
              onPress={() => {
                setSelectedCategory(item);
                setCategoryMenuVisible(false);
              }}
            />
          ))}
        </Menu>

        <Surface style={styles.inlineCard} elevation={0}>
          <Text variant="titleMedium" style={styles.inlineCardTitle}>
            Crear categoria
          </Text>
          <TextInput
            mode="outlined"
            label="Nueva categoria"
            value={newCategoryName}
            onChangeText={(value) => {
              setNewCategoryName(value);
              if (categoryError) {
                setCategoryError("");
              }
            }}
            style={styles.input}
            returnKeyType="done"
            onSubmitEditing={() => void handleCreateCategory()}
          />
          <HelperText type="error" visible={Boolean(categoryError)}>
            {categoryError}
          </HelperText>
          <ButtonCustom
            label="Agregar categoria"
            onPress={handleCreateCategory}
            loading={creatingCategory}
            icon="shape-plus"
            mode="outlined"
          />

          {customCategories.length ? (
            <View style={styles.customCategoryList}>
              <Text style={styles.customCategoryTitle}>
                Categorías personalizadas
              </Text>
              {customCategories.map((item) => (
                <View key={item.id} style={styles.customCategoryRow}>
                  <Text style={styles.customCategoryName}>{item.name}</Text>
                  <IconButton
                    icon="delete-outline"
                    iconColor={Colors.error}
                    size={20}
                    disabled={deletingCategoryId === item.id}
                    onPress={() => handleDeleteCategory(item)}
                  />
                </View>
              ))}
            </View>
          ) : null}
        </Surface>

        <View style={isLargeScreen ? styles.formGrid : null}>
          <View style={isLargeScreen ? styles.formColumn : null}>
            <TextInput
              mode="outlined"
              label={`Monto en ${currency.code}`}
              value={amount}
              onChangeText={handleAmountChange}
              keyboardType="number-pad"
              style={styles.input}
              returnKeyType="next"
            />

            <TextInput
              mode="outlined"
              label={
                movementType === "expense"
                  ? "Descripción del gasto"
                  : movementType === "investment"
                    ? "Descripción de la inversión"
                    : "Descripción del ingreso"
              }
              value={description}
              onChangeText={setDescription}
              style={styles.input}
              returnKeyType={movementType === "investment" ? "next" : "done"}
              onSubmitEditing={() => {
                if (movementType !== "investment") {
                  void handleSubmit();
                }
              }}
            />

            {movementType === "investment" ? (
              <>
                <TextInput
                  mode="outlined"
                  label="Rentabilidad esperada %"
                  value={expectedReturnRate}
                  onChangeText={setExpectedReturnRate}
                  keyboardType="decimal-pad"
                  style={styles.input}
                  returnKeyType="done"
                  onSubmitEditing={() => void handleSubmit()}
                />

                <Menu
                  visible={returnFrequencyMenuVisible}
                  onDismiss={() => setReturnFrequencyMenuVisible(false)}
                  anchor={
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setReturnFrequencyMenuVisible(true)}
                      style={styles.selector}
                    >
                      <Text style={styles.selectorLabel}>Periodo de retorno</Text>
                      <Text style={styles.selectorValue}>
                        {
                          investmentReturnOptions.find(
                            (item) => item.value === expectedReturnFrequency
                          )?.label
                        }
                      </Text>
                    </TouchableOpacity>
                  }
                >
                  {investmentReturnOptions.map((item) => (
                    <Menu.Item
                      key={item.value}
                      title={item.label}
                      onPress={() => {
                        setExpectedReturnFrequency(item.value);
                        setReturnFrequencyMenuVisible(false);
                      }}
                    />
                  ))}
                </Menu>
              </>
            ) : null}
          </View>

          <View style={isLargeScreen ? styles.formColumn : null}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowDatePicker(true)}
              style={styles.selector}
            >
              <Text style={styles.selectorLabel}>Fecha</Text>
              <Text style={styles.selectorValue}>{date}</Text>
            </TouchableOpacity>

            {showDatePicker ? (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleDateChange}
              />
            ) : null}
          </View>
        </View>

        <HelperText type="info" visible>
          {movementType === "expense"
            ? `Los gastos restan de tu disponible. Registra el valor en ${currency.code}. Ejemplo: ${formatCurrency(125000)}.`
            : movementType === "investment"
              ? `Las inversiones sí reducen el efectivo disponible, pero siguen contando como dinero puesto a crecer. ${
                  projectedReturn > 0
                    ? `Con esta configuración la ganancia estimada sería ${formatCurrency(projectedReturn)} por ${expectedReturnFrequency === "monthly" ? "mes" : "año"}.`
                    : `Si agregas un porcentaje, la app calculará cuánto podrías ganar por ${expectedReturnFrequency === "monthly" ? "mes" : "año"}.`
                }`
              : `Los ingresos adicionales compensan tus gastos y aumentan tu balance. Ejemplo: ${formatCurrency(125000)}.`}
        </HelperText>

        <HelperText type="error" visible={Boolean(error)}>
          {error}
        </HelperText>

        <View style={styles.buttonWrapper}>
          <ButtonCustom
            label={
              movementType === "expense"
                ? "Guardar gasto"
                : movementType === "investment"
                  ? "Guardar inversión"
                  : "Guardar ingreso"
            }
            onPress={handleSubmit}
            loading={loading}
            disabled={loadingData}
            icon="content-save"
          />
        </View>
      </Surface>
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
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    maxWidth: 980,
    alignSelf: "center",
    width: "100%",
  },
  cardLarge: {
    padding: 24,
  },
  cardCompact: {
    padding: 16,
    borderRadius: 20,
  },
  title: {
    color: Colors.textPrimary,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.textSecondary,
    marginBottom: 18,
  },
  noticeCard: {
    backgroundColor: "#F6F4E8",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  noticeTitle: {
    color: Colors.textPrimary,
    fontWeight: "700",
    marginBottom: 4,
  },
  noticeText: {
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  loadingText: {
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  input: {
    marginBottom: 12,
    backgroundColor: Colors.surface,
  },
  selector: {
    borderWidth: 1,
    borderColor: Colors.outline,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  selectorLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  selectorValue: {
    color: Colors.textPrimary,
    fontSize: 16,
  },
  inlineCard: {
    backgroundColor: "#F8FBF7",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  formGrid: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },
  formColumn: {
    flex: 1,
  },
  inlineCardTitle: {
    color: Colors.textPrimary,
    fontWeight: "700",
    marginBottom: 10,
  },
  customCategoryList: {
    marginTop: 14,
    gap: 8,
  },
  customCategoryTitle: {
    color: Colors.textPrimary,
    fontWeight: "700",
  },
  customCategoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingLeft: 12,
    gap: 8,
  },
  customCategoryName: {
    color: Colors.textPrimary,
    flex: 1,
  },
  buttonWrapper: {
    marginTop: 4,
  },
});
