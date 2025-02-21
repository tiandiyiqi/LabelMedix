export const themes = {
  forest: {
    name: "森林绿",
    primary: "#2D6A4F",
    secondary: "#95D5B2",
    background: "#D8F3DC",
    accent: "#40916C",
    text: "#081C15",
    lightText: "#52B788",
    border: "#95D5B2",
    buttonText: "#FFFFFF",
  },
  pharmaceutical: {
    name: "药剂师",
    primary: "#1976D2",
    secondary: "#64B5F6",
    background: "#F5F9FC",
    accent: "#8FBC8F",
    text: "#2C3E50",
    lightText: "#607D8B",
    border: "#BBDEFB",
    buttonText: "#FFFFFF",
  },
  mathemagiker: {
    name: "数学魔法师",
    primary: "#07889B",
    secondary: "#66B9BF",
    background: "#F5F9FA",
    accent: "#E9967A",
    text: "#2C3E50",
    lightText: "#607D8B",
    border: "#66B9BF",
    buttonText: "#FFFFFF",
  },
}

export type ThemeName = keyof typeof themes

