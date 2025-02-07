export const themes = {
  pharmaceutical: {
    name: "药剂师",
    primary: "#2196F3",
    secondary: "#03A9F4",
    background: "#E3F2FD",
    accent: "#FFC107",
    text: "#333333",
    lightText: "#666666",
    border: "#E0E0E0",
    buttonText: "#FFFFFF",
  },
  mathemagiker: {
    name: "数学魔法师",
    primary: "#07889B",
    secondary: "#66B9BF",
    background: "#F5F9FA",
    accent: "#E37222",
    text: "#2C3E50",
    lightText: "#607D8B",
    border: "#66B9BF",
    buttonText: "#FFFFFF",
  },
}

export type ThemeName = keyof typeof themes

