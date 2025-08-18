function isValidWikipediaUrl(url) {
  try {
    const u = new URL(url);
    return (
      u.hostname.includes("wikipedia.org") &&
      u.pathname.includes("/wiki/") &&
      !u.pathname.includes(":") &&
      !u.pathname.includes("disambiguation")
    );
  } catch {
    return false;
  }
}

async function extractWikipediaTitle(url) {
  try {
    const u = new URL(url);
    const raw = decodeURIComponent(u.pathname.split("/wiki/")[1] || "");
    return raw.replace(/_/g, " ");
  } catch {
    return "Unknown Article";
  }
}

function generateAvatar() {
  const colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FECA57",
    "#FF9FF3",
    "#54A0FF",
    "#5F27CD",
  ];
  const icons = [
    "🎯",
    "🎪",
    "🎨",
    "🎭",
    "🎲",
    "🎸",
    "🎺",
    "🎻",
    "🎹",
    "🚀",
    "🦄",
    "🐸",
    "🐙",
    "🦋",
    "🌟",
  ];
  return {
    color: colors[Math.floor(Math.random() * colors.length)],
    icon: icons[Math.floor(Math.random() * icons.length)],
  };
}

module.exports = {
  isValidWikipediaUrl,
  extractWikipediaTitle,
  generateAvatar,
};
