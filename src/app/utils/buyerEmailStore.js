const STORAGE_KEY = "norya_buyer_email";

let memoryEmail = "";

export const buyerEmailStore = {
  get() {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) return saved;
    }
    return memoryEmail;
  },
  set(email) {
    memoryEmail = email;
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(STORAGE_KEY, email);
      } catch {}
    }
  },
  clear() {
    memoryEmail = "";
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  },
};
