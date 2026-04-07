import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { HelperText, Surface, Text, TextInput } from "react-native-paper";
import ButtonCustom from "../components/ButtonCustom";
import { Colors } from "../constants/Colors";
import { useAuth } from "../hooks/useAuth";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ProfileScreen() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(user?.name || "");
    setEmail(user?.email || "");
    setPhone(user?.phone || "");
  }, [user]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    if (!emailRegex.test(email.trim().toLowerCase())) {
      setError("Ingresa un correo válido.");
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
});
