import React from "react";
import { StyleSheet } from "react-native";
import { Button } from "react-native-paper";
import { Colors } from "../constants/Colors";

interface ButtonCustomProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  mode?: "text" | "outlined" | "contained";
  icon?: string;
}

export default function ButtonCustom({
  label,
  onPress,
  loading = false,
  disabled = false,
  mode = "contained",
  icon,
}: ButtonCustomProps) {
  return (
    <Button
      mode={mode}
      icon={icon}
      loading={loading}
      disabled={disabled}
      onPress={onPress}
      contentStyle={styles.content}
      style={[
        styles.button,
        mode === "outlined" ? styles.outlinedButton : null,
        mode === "text" ? styles.textButton : null,
      ]}
      labelStyle={[
        styles.label,
        mode === "text" ? styles.textLabel : null,
        mode === "outlined" ? styles.outlinedLabel : null,
      ]}
    >
      {label}
    </Button>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  outlinedButton: {
    backgroundColor: "transparent",
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  textButton: {
    backgroundColor: "transparent",
  },
  content: {
    minHeight: 52,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
  },
  textLabel: {
    color: Colors.surface,
  },
  outlinedLabel: {
    color: Colors.primary,
  },
});
