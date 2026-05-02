import React from "react";
import { Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "react-native-paper";
import { Colors } from "../constants/Colors";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

export function SurfaceStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function SidebarItem({
  icon,
  label,
  active,
  danger,
  onPress,
}: {
  icon: IconName;
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

export function QuickDockButton({
  icon,
  onPress,
}: {
  icon: IconName;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.quickDockButton}>
      <MaterialCommunityIcons name={icon} size={22} color={Colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
