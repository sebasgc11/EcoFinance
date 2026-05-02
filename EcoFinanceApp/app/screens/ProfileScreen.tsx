import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Avatar, HelperText, Menu, Surface, Text, TextInput } from "react-native-paper";
import ButtonCustom from "../components/ButtonCustom";
import { Colors } from "../constants/Colors";
import { useAuth } from "../hooks/useAuth";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const incomeFrequencies = [
  { value: "monthly", label: "Mensual" },
  { value: "biweekly", label: "Quincenal" },
  { value: "weekly", label: "Semanal" },
];

export default function ProfileScreen() {
  const { user, updateProfile } = useAuth();
  const cameraRef = useRef<CameraView | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraFacing, setCameraFacing] = useState<CameraType>("front");
  const [cameraVisible, setCameraVisible] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [baseIncome, setBaseIncome] = useState("");
  const [incomeFrequency, setIncomeFrequency] = useState("monthly");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [frequencyMenuVisible, setFrequencyMenuVisible] = useState(false);

  useEffect(() => {
    setName(user?.name || "");
    setEmail(user?.email || "");
    setPhone(user?.phone || "");
    setBaseIncome(user?.base_income ? String(user.base_income) : "");
    setIncomeFrequency(user?.income_frequency || "monthly");
    setAvatarUri(user?.avatarUri || null);
  }, [user]);

  // Iniciar cámara web en tiempo real
  useEffect(() => {
    if (!cameraVisible || Platform.OS !== "web") return;

    const initWebCamera = async () => {
      try {
        const constraints = {
          video: {
            facingMode: cameraFacing === "front" ? "user" : "environment",
            width: { ideal: 400 },
            height: { ideal: 400 },
          },
        };
        const stream = await (navigator.mediaDevices?.getUserMedia(constraints) as Promise<MediaStream>);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError("No se pudo acceder a la cámara web. Verifica los permisos.");
      }
    };

    initWebCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, [cameraVisible, cameraFacing]);

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Debes permitir acceso a tus fotos para elegir una imagen.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    if (Platform.OS === "web") {
      setError("");
      setCameraVisible(true);
      return;
    }

    const permission = cameraPermission?.granted
      ? cameraPermission
      : await requestCameraPermission();

    if (!permission?.granted) {
      setError("Debes permitir acceso a la cámara para tomar una foto.");
      return;
    }

    setError("");
    setCameraVisible(true);
  };

  const handleCapturePhoto = async () => {
    try {
      if (Platform.OS === "web") {
        if (!videoRef.current || !canvasRef.current) {
          setError("Cámara web no disponible.");
          return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          setError("No se pudo capturar la foto.");
          return;
        }

        canvas.width = video.videoWidth || 400;
        canvas.height = video.videoHeight || 400;
        ctx.drawImage(video, 0, 0);

        const photoUri = canvas.toDataURL("image/jpeg", 0.7);
        setAvatarUri(photoUri);
        setCameraVisible(false);
        return;
      }

      if (!cameraRef.current) {
        return;
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
      });

      if (photo?.uri) {
        setAvatarUri(photo.uri);
        setCameraVisible(false);
      }
    } catch {
      setError("No fue posible tomar la foto en este momento.");
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    if (!emailRegex.test(email.trim().toLowerCase())) {
      setError("Ingresa un correo válido.");
      return;
    }

    if (baseIncome && (Number.isNaN(Number(baseIncome)) || Number(baseIncome) < 0)) {
      setError("El ingreso base debe ser un número válido.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");
      await updateProfile({
        name,
        email,
        phone,
        avatarUri,
        baseIncome: baseIncome ? Number(baseIncome) : null,
        incomeFrequency,
      });
      setSuccess("Tu información fue actualizada correctamente.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No fue posible actualizar el perfil."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Surface style={styles.card} elevation={1}>
          <Text variant="headlineSmall" style={styles.title}>
            Información personal
          </Text>
          <Text style={styles.subtitle}>
            Actualiza tu nombre, correo y teléfono desde este panel.
          </Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Rol</Text>
            <Text style={styles.infoValue}>
              {user?.is_admin ? "Administrador" : "Usuario"}
            </Text>
          </View>

          <View style={styles.avatarSection}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handlePickImage}
              style={styles.avatarButton}
            >
              {avatarUri ? (
                <Avatar.Image size={88} source={{ uri: avatarUri }} />
              ) : (
                <Avatar.Text
                  size={88}
                  label={(name || user?.name || "U").slice(0, 2).toUpperCase()}
                  style={styles.avatarFallback}
                />
              )}
            </TouchableOpacity>
            <View style={styles.avatarInfo}>
              <Text style={styles.avatarTitle}>Foto de perfil</Text>
              <Text style={styles.avatarText}>
                Agrega una foto desde tu galería o toma una nueva con la cámara.
              </Text>
            </View>
          </View>

          <View style={styles.avatarActions}>
            <View style={styles.avatarActionButton}>
              <ButtonCustom
                label="Elegir foto"
                onPress={handlePickImage}
                mode="outlined"
                icon="image-outline"
              />
            </View>
            <View style={styles.avatarActionButton}>
              <ButtonCustom
                label="Tomar foto"
                onPress={handleTakePhoto}
                mode="outlined"
                icon="camera-outline"
              />
            </View>
          </View>

          <TextInput
            mode="outlined"
            label="Nombre completo"
            value={name}
            onChangeText={setName}
            style={styles.input}
          />
          <TextInput
            mode="outlined"
            label="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />
          <TextInput
            mode="outlined"
            label="Teléfono"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            style={styles.input}
          />

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Ingreso base
          </Text>
          <Text style={styles.sectionSubtitle}>
            Este valor representa el ingreso recurrente con el que empieza tu balance.
          </Text>

          <TextInput
            mode="outlined"
            label="Ingreso base"
            value={baseIncome}
            onChangeText={setBaseIncome}
            keyboardType="decimal-pad"
            style={styles.input}
          />

          <Menu
            visible={frequencyMenuVisible}
            onDismiss={() => setFrequencyMenuVisible(false)}
            anchor={
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setFrequencyMenuVisible(true)}
                style={styles.selector}
              >
                <Text style={styles.selectorLabel}>Frecuencia del ingreso</Text>
                <Text style={styles.selectorValue}>
                  {incomeFrequencies.find((item) => item.value === incomeFrequency)?.label ||
                    "Mensual"}
                </Text>
              </TouchableOpacity>
            }
          >
            {incomeFrequencies.map((item) => (
              <Menu.Item
                key={item.value}
                title={item.label}
                onPress={() => {
                  setIncomeFrequency(item.value);
                  setFrequencyMenuVisible(false);
                }}
              />
            ))}
          </Menu>

          <HelperText type="error" visible={Boolean(error)}>
            {error}
          </HelperText>
          <HelperText type="info" visible={Boolean(success)}>
            {success}
          </HelperText>

          <ButtonCustom
            label="Guardar cambios"
            onPress={handleSave}
            loading={loading}
            icon="content-save"
          />
        </Surface>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={cameraVisible}
        onRequestClose={() => setCameraVisible(false)}
      >
        <View style={styles.cameraModalBackdrop}>
          <View style={styles.cameraModalCard}>
            <View style={styles.cameraHeader}>
              <Text style={styles.cameraTitle}>Tomar foto</Text>
              <TouchableOpacity
                onPress={() => setCameraVisible(false)}
                style={styles.cameraCloseButton}
              >
                <Text style={styles.cameraCloseText}>Cerrar</Text>
              </TouchableOpacity>
            </View>

            {Platform.OS === "web" ? (
              <div style={{ width: "100%", borderRadius: 22, overflow: "hidden", backgroundColor: "#0F1720", marginBottom: 16 } as any}>
                <video
                  ref={videoRef as any}
                  autoPlay
                  playsInline
                  style={{ width: "100%", height: "400px", objectFit: "cover" } as any}
                />
              </div>
            ) : (
              <View style={styles.cameraFrame}>
                <CameraView
                  ref={cameraRef}
                  style={StyleSheet.absoluteFillObject}
                  facing={cameraFacing}
                />
              </View>
            )}

            <canvas ref={canvasRef} style={{ display: "none" } as any} />

            <View style={styles.cameraActions}>
              {Platform.OS !== "web" && (
                <View style={styles.cameraActionButton}>
                  <ButtonCustom
                    label="Cambiar cámara"
                    onPress={() =>
                      setCameraFacing((current) =>
                        current === "front" ? "back" : "front"
                      )
                    }
                    mode="outlined"
                    icon="camera-flip-outline"
                  />
                </View>
              )}
              <View style={styles.cameraActionButton}>
                <ButtonCustom
                  label="Capturar"
                  onPress={handleCapturePhoto}
                  icon="camera"
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
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
  infoBox: {
    borderRadius: 16,
    backgroundColor: "#EEF5FB",
    padding: 14,
    marginBottom: 16,
  },
  infoLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  infoValue: {
    color: Colors.textPrimary,
    fontWeight: "700",
  },
  input: {
    backgroundColor: Colors.surface,
    marginBottom: 12,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: Colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
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
  avatarSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 18,
  },
  avatarButton: {
    borderRadius: 999,
  },
  avatarFallback: {
    backgroundColor: Colors.primary,
  },
  avatarInfo: {
    flex: 1,
  },
  avatarTitle: {
    color: Colors.textPrimary,
    fontWeight: "700",
    marginBottom: 4,
  },
  avatarText: {
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  avatarActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 18,
  },
  avatarActionButton: {
    flex: 1,
    minWidth: 180,
  },
  cameraModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 16, 24, 0.78)",
    justifyContent: "center",
    padding: 18,
  },
  cameraModalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 16,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  cameraHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 12,
  },
  cameraTitle: {
    color: Colors.textPrimary,
    fontWeight: "800",
    fontSize: 20,
  },
  cameraCloseButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#EEF5FB",
  },
  cameraCloseText: {
    color: Colors.primary,
    fontWeight: "700",
  },
  cameraFrame: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#0F1720",
    marginBottom: 16,
  },
  cameraActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  cameraActionButton: {
    flex: 1,
    minWidth: 180,
  },
});
