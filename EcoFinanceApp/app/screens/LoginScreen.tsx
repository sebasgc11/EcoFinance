import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  HelperText,
  SegmentedButtons,
  Surface,
  Text,
  TextInput,
} from "react-native-paper";
import ButtonCustom from "../components/ButtonCustom";
import { useAuth } from "../hooks/useAuth";
import { Colors } from "../constants/Colors";
import { userService } from "../services/api";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^[0-9+\s()-]{7,20}$/;

const previewSlides = [
  {
    title: "Gastos del mes",
    amount: "$ 2.450.000",
    rows: [
      { label: "Hogar", value: "38%" },
      { label: "Transporte", value: "21%" },
    ],
    bars: [34, 56, 72, 44],
  },
  {
    title: "Ingresos vs ahorro",
    amount: "$ 1.180.000",
    rows: [
      { label: "Ahorro", value: "29%" },
      { label: "Inversión", value: "17%" },
    ],
    bars: [48, 36, 68, 78],
  },
  {
    title: "Resumen semanal",
    amount: "$ 620.000",
    rows: [
      { label: "Comida", value: "26%" },
      { label: "Salud", value: "14%" },
    ],
    bars: [26, 64, 42, 58],
  },
  {
    title: "Flujo trimestral",
    amount: "$ 4.860.000",
    rows: [
      { label: "Ingresos", value: "61%" },
      { label: "Metas", value: "24%" },
    ],
    bars: [38, 74, 52, 82],
  },
  {
    title: "Balance proyectado",
    amount: "$ 3.120.000",
    rows: [
      { label: "Ahorro", value: "33%" },
      { label: "Libre", value: "19%" },
    ],
    bars: [62, 46, 78, 58],
  },
];

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetVisible, setResetVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [previewIndex, setPreviewIndex] = useState(0);
  const previewOpacity = useRef(new Animated.Value(1)).current;
  const previewRotate = useRef(new Animated.Value(0)).current;
  const previewTranslate = useRef(new Animated.Value(0)).current;

  const isCompact = width < 640;
  const isLargeScreen = width >= 980;
  const cardWidth = useMemo(() => Math.min(width - 32, 560), [width]);
  const activePreview = previewSlides[previewIndex];

  const animatePreviewChange = (nextIndex: number) => {
    Animated.parallel([
      Animated.timing(previewOpacity, {
        toValue: 0.05,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(previewRotate, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(previewTranslate, {
        toValue: -28,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setPreviewIndex(nextIndex);
      previewRotate.setValue(-1);
      previewTranslate.setValue(28);

      Animated.parallel([
        Animated.timing(previewOpacity, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.timing(previewRotate, {
          toValue: 0,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.timing(previewTranslate, {
          toValue: 0,
          duration: 420,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      animatePreviewChange((previewIndex + 1) % previewSlides.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [previewIndex, previewOpacity, previewRotate, previewTranslate]);

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("El email es obligatorio.");
      return;
    }

    if (!emailRegex.test(normalizedEmail)) {
      setError("Ingresa un email válido.");
      return;
    }

    if (mode === "register") {
      if (!firstName.trim()) {
        setError("Los nombres son obligatorios.");
        return;
      }

      if (!lastName.trim()) {
        setError("Los apellidos son obligatorios.");
        return;
      }

      if (!phone.trim()) {
        setError("El teléfono es obligatorio.");
        return;
      }

      if (!phoneRegex.test(phone.trim())) {
        setError("Ingresa un teléfono válido.");
        return;
      }

      if (password.length < 6) {
        setError("La contraseña debe tener al menos 6 caracteres.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Las contraseñas no coinciden.");
        return;
      }
    }

    if (mode === "login" && !password) {
      setError("La contraseña es obligatoria.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      if (mode === "login") {
        await signIn({ email: normalizedEmail, password });
      } else {
        await signUp({
          firstName,
          lastName,
          phone,
          email: normalizedEmail,
          password,
        });
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "No fue posible procesar la autenticación.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreview = (index: number) => {
    if (index === previewIndex) {
      return;
    }

    animatePreviewChange(index);
  };

  const handleRequestResetCode = async () => {
    const normalizedEmail = resetEmail.trim().toLowerCase();
    if (!emailRegex.test(normalizedEmail)) {
      setError("Ingresa un correo válido para recuperar tu contraseña.");
      return;
    }

    try {
      setResetLoading(true);
      setError("");
      const response = await userService.requestPasswordReset({
        email: normalizedEmail,
      });
      setResetMessage(response.message);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible enviar el código de recuperación."
      );
    } finally {
      setResetLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    const normalizedEmail = resetEmail.trim().toLowerCase();
    if (!emailRegex.test(normalizedEmail)) {
      setError("Ingresa un correo válido.");
      return;
    }

    if (resetPassword.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (resetPassword !== resetConfirmPassword) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }

    try {
      setResetLoading(true);
      setError("");
      const response = await userService.confirmPasswordReset({
        email: normalizedEmail,
        new_password: resetPassword,
      });
      setResetMessage(response.message);
      setResetVisible(false);
      setPassword("");
      setResetPassword("");
      setResetConfirmPassword("");
      setEmail(normalizedEmail);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible restablecer la contraseña."
      );
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLargeScreen ? styles.scrollContentLarge : null,
          isCompact ? styles.scrollContentCompact : null,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.heroPanel,
            isLargeScreen ? styles.heroPanelLarge : null,
            isCompact ? styles.heroPanelCompact : null,
          ]}
        >
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>EF</Text>
          </View>
          <Text variant="headlineMedium" style={styles.title}>
            Gestiona tus finanzas de manera inteligente
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            Administra tus finanzas, crea categorías y analiza tu comportamiento
            con IA.
          </Text>

          <Animated.View
            style={[
              styles.previewCard,
              {
                opacity: previewOpacity,
                transform: [
                  {
                    rotateY: previewRotate.interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: ["-24deg", "0deg", "24deg"],
                    }),
                  },
                  {
                    translateX: previewTranslate,
                  },
                  {
                    scale: previewOpacity.interpolate({
                      inputRange: [0.15, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.previewPhone}>
              <View style={styles.previewTopBar}>
                <Text style={styles.previewAppName}>EcoFinance Intelligence</Text>
                <View style={styles.previewDot} />
              </View>
              <View style={styles.previewChart}>
                {activePreview.bars.map((height, index) => (
                  <View key={`${previewIndex}-${index}`} style={[styles.previewBar, { height }]} />
                ))}
              </View>
              <View style={styles.previewExpenseCard}>
                <Text style={styles.previewExpenseTitle}>{activePreview.title}</Text>
                <Text style={styles.previewExpenseAmount}>{activePreview.amount}</Text>
                {activePreview.rows.map((row) => (
                  <View key={`${previewIndex}-${row.label}`} style={styles.previewExpenseRow}>
                    <Text style={styles.previewExpenseLabel}>{row.label}</Text>
                    <Text style={styles.previewExpenseValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.previewNotes}>
              <View style={styles.previewMiniCard}>
                <Text style={styles.previewMiniTitle}>Control diario</Text>
                <Text style={styles.previewMiniText}>
                  Registra movimientos y categorías en segundos.
                </Text>
              </View>
              <View style={styles.previewMiniCard}>
                <Text style={styles.previewMiniTitle}>Panel claro</Text>
                <Text style={styles.previewMiniText}>
                  Visualiza tu progreso desde cualquier dispositivo.
                </Text>
              </View>
              <View style={styles.previewIndicators}>
                {previewSlides.map((_, index) => (
                  <TouchableOpacity
                    key={`indicator-${index}`}
                    activeOpacity={0.85}
                    onPress={() => handleSelectPreview(index)}
                    style={styles.previewIndicatorButton}
                  >
                    <View
                      style={[
                        styles.previewIndicator,
                        index === previewIndex ? styles.previewIndicatorActive : null,
                      ]}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Animated.View>
        </View>

        <Surface style={[styles.card, { width: cardWidth }]} elevation={2}>
          <Text variant="titleLarge" style={styles.cardTitle}>
            {mode === "login" ? "Bienvenido de nuevo" : "Crea tu cuenta"}
          </Text>
          <Text style={styles.cardSubtitle}>
            {mode === "login"
              ? "Ingresa con tu correo y contraseña."
              : "Completa tus datos para registrarte y empieza a organizar tus finanzas."}
          </Text>

          <SegmentedButtons
            value={mode}
            onValueChange={(value) => {
              setMode(value as "login" | "register");
              setError("");
            }}
            buttons={[
              { value: "login", label: "Login" },
              { value: "register", label: "Registro" },
            ]}
            style={styles.segmented}
          />

          {mode === "register" ? (
            <View style={[styles.row, isCompact ? styles.rowCompact : null]}>
              <TextInput
                mode="outlined"
                label="Nombres"
                value={firstName}
                onChangeText={setFirstName}
                style={[styles.input, styles.halfInput]}
                returnKeyType="next"
              />
              <TextInput
                mode="outlined"
                label="Apellidos"
                value={lastName}
                onChangeText={setLastName}
                style={[styles.input, styles.halfInput]}
                returnKeyType="next"
              />
            </View>
          ) : null}

          {mode === "register" ? (
            <TextInput
              mode="outlined"
              label="Teléfono"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              style={styles.input}
              returnKeyType="next"
            />
          ) : null}

          <TextInput
            mode="outlined"
            label={mode === "register" ? "Correo electrónico" : "Correo registrado"}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
            returnKeyType="next"
          />

          <TextInput
            mode="outlined"
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
            returnKeyType={mode === "register" ? "next" : "go"}
            onSubmitEditing={() => {
              if (mode === "login") {
                void handleSubmit();
              }
            }}
          />

          {mode === "register" ? (
            <TextInput
              mode="outlined"
              label="Confirmar contraseña"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              style={styles.input}
              returnKeyType="go"
              onSubmitEditing={() => void handleSubmit()}
            />
          ) : null}

          <HelperText type="info" visible>
            {mode === "login"
              ? "Inicia sesión con correo y contraseña."
              : "Registra tu cuenta con correo, teléfono y contraseña."}
          </HelperText>

          {mode === "login" ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                setResetVisible(true);
                setResetEmail(email.trim().toLowerCase());
                setResetMessage("");
                setError("");
              }}
              style={styles.forgotPasswordButton}
            >
              <Text style={styles.forgotPasswordText}>
                Olvidé mi contraseña
              </Text>
            </TouchableOpacity>
          ) : null}

          <HelperText type="error" visible={Boolean(error)}>
            {error}
          </HelperText>

          <ButtonCustom
            label={mode === "login" ? "Entrar" : "Crear cuenta"}
            onPress={handleSubmit}
            loading={loading}
            icon={mode === "login" ? "login" : "account-plus"}
          />
        </Surface>
      </ScrollView>

      <Modal
        visible={resetVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setResetVisible(false)}
      >
        <View style={styles.resetBackdrop}>
          <Surface style={styles.resetCard} elevation={3}>
            <Text variant="titleLarge" style={styles.resetTitle}>
              Recuperar contraseña
            </Text>
            <Text style={styles.resetSubtitle}>
              Escribe tu correo y define una nueva contraseña para recuperar el acceso.
            </Text>

            <TextInput
              mode="outlined"
              label="Correo electrónico"
              value={resetEmail}
              onChangeText={setResetEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              returnKeyType="next"
            />

            <View style={styles.resetActionGap}>
              <ButtonCustom
                label="Validar correo"
                onPress={handleRequestResetCode}
                loading={resetLoading}
                mode="outlined"
                icon="email-check-outline"
              />
            </View>
            <TextInput
              mode="outlined"
              label="Nueva contraseña"
              value={resetPassword}
              onChangeText={setResetPassword}
              secureTextEntry
              style={styles.input}
              returnKeyType="next"
            />
            <TextInput
              mode="outlined"
              label="Confirmar nueva contraseña"
              value={resetConfirmPassword}
              onChangeText={setResetConfirmPassword}
              secureTextEntry
              style={styles.input}
              returnKeyType="go"
              onSubmitEditing={() => void handleConfirmReset()}
            />

            <HelperText type="info" visible={Boolean(resetMessage)}>
              {resetMessage}
            </HelperText>

            <View style={styles.resetButtonsRow}>
              <View style={styles.resetButtonWrap}>
                <ButtonCustom
                  label="Cancelar"
                  onPress={() => setResetVisible(false)}
                  mode="outlined"
                />
              </View>
              <View style={styles.resetButtonWrap}>
                <ButtonCustom
                  label="Cambiar contraseña"
                  onPress={handleConfirmReset}
                  loading={resetLoading}
                  icon="lock-reset"
                />
              </View>
            </View>
          </Surface>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 28,
    gap: 18,
  },
  scrollContentCompact: {
    paddingHorizontal: 12,
    paddingVertical: 20,
  },
  scrollContentLarge: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 22,
  },
  heroPanel: {
    width: "100%",
    maxWidth: 560,
    backgroundColor: Colors.primary,
    borderRadius: 28,
    padding: 24,
    minHeight: 240,
    overflow: "hidden",
  },
  heroPanelLarge: {
    flex: 1,
    maxWidth: 520,
    justifyContent: "space-between",
  },
  heroPanelCompact: {
    padding: 18,
    borderRadius: 24,
  },
  brandBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  brandBadgeText: {
    color: Colors.surface,
    fontSize: 22,
    fontWeight: "700",
  },
  title: {
    color: Colors.surface,
    fontWeight: "800",
    marginBottom: 10,
    lineHeight: 38,
  },
  subtitle: {
    color: "#E7F6ED",
    lineHeight: 24,
    marginBottom: 18,
  },
  previewCard: {
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  previewPhone: {
    backgroundColor: "#F7FBF8",
    borderRadius: 24,
    padding: 14,
    marginBottom: 12,
  },
  previewTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  previewAppName: {
    color: Colors.textPrimary,
    fontWeight: "800",
    fontSize: 15,
  },
  previewDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: Colors.success,
  },
  previewChart: {
    height: 88,
    borderRadius: 18,
    backgroundColor: "#EAF2FB",
    paddingHorizontal: 14,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    marginBottom: 12,
  },
  previewBar: {
    flex: 1,
    backgroundColor: Colors.secondary,
    borderRadius: 10,
  },
  previewExpenseCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 14,
  },
  previewExpenseTitle: {
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  previewExpenseAmount: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
  },
  previewExpenseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  previewExpenseLabel: {
    color: Colors.textSecondary,
  },
  previewExpenseValue: {
    color: Colors.primary,
    fontWeight: "700",
  },
  previewNotes: {
    gap: 10,
  },
  previewMiniCard: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 14,
  },
  previewMiniTitle: {
    color: Colors.surface,
    fontWeight: "700",
    marginBottom: 4,
  },
  previewMiniText: {
    color: "#E4F4EB",
    lineHeight: 20,
  },
  previewIndicators: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  previewIndicatorButton: {
    paddingVertical: 4,
    paddingRight: 2,
  },
  previewIndicator: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  previewIndicatorActive: {
    width: 26,
    backgroundColor: "#FFFFFF",
  },
  card: {
    backgroundColor: Colors.surface,
    padding: 22,
    borderRadius: 28,
    maxWidth: 560,
    shadowColor: "#163A2B",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  cardTitle: {
    color: Colors.textPrimary,
    marginBottom: 6,
    fontWeight: "800",
  },
  cardSubtitle: {
    color: Colors.textSecondary,
    lineHeight: 21,
    marginBottom: 16,
  },
  segmented: {
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  rowCompact: {
    flexDirection: "column",
    gap: 0,
  },
  input: {
    marginBottom: 12,
    backgroundColor: Colors.surface,
  },
  buttonSpacer: {
    height: 10,
  },
  forgotPasswordButton: {
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  forgotPasswordText: {
    color: Colors.primary,
    fontWeight: "700",
  },
  googleButton: {
    minHeight: 50,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DADCE0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleButtonText: {
    color: "#3C4043",
    fontSize: 16,
    fontWeight: "500",
  },
  googleContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  halfInput: {
    flex: 1,
  },
  resetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 18, 28, 0.52)",
    justifyContent: "center",
    padding: 20,
  },
  resetCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  resetTitle: {
    color: Colors.textPrimary,
    fontWeight: "800",
    marginBottom: 6,
  },
  resetSubtitle: {
    color: Colors.textSecondary,
    lineHeight: 21,
    marginBottom: 14,
  },
  resetActionGap: {
    marginBottom: 12,
  },
  resetButtonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 6,
  },
  resetButtonWrap: {
    flex: 1,
    minWidth: 180,
  },
});
