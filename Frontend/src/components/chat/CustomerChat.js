import React, { useState, useCallback, useEffect } from "react";
import { useChatSocket } from "../../hooks/useChatSocket";

function CustomerChat({ user }) {
  // Guest ID yönetimi
  const [guestId] = useState(() => {
    const stored = localStorage.getItem("chatGuestId");
    if (stored) return stored;
    const newId = `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("chatGuestId", newId);
    return newId;
  });

  // Kullanıcı varsa onun ID'si, yoksa Guest ID kullan
  const currentUserId = user ? (user._id || user.id) : guestId;
  const currentUserName = user ? (user.name || "Customer") : "Guest";
  const chatId = `chat-${currentUserId}`;

  // Chat her zaman hazır (Guest de olsa)
  const isReady = true;

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Pencere durumunu yerel depolamada sakla
  const [open, setOpen] = useState(() => {
    const savedState = localStorage.getItem("chatWindowOpen");
    return savedState === "true";
  });

  useEffect(() => {
    localStorage.setItem("chatWindowOpen", open);
  }, [open]);

  // 1️⃣ Yeni Mesaj Geldiğinde Listeye Ekle (Socket Callback)
  const handleNewMessage = useCallback((msg) => {
    setMessages((prev) => {
      // Mükerrer mesaj kontrolü
      const isDuplicate = prev.some(m => m.timestamp === msg.timestamp && m.text === msg.text);
      if (isDuplicate) return prev;
      return [...prev, msg];
    });
  }, []);

  // 2️⃣ Socket Bağlantısını Başlat
  const { sendMessage } = useChatSocket({
    chatId,
    onMessage: handleNewMessage,
  });

  // 3️⃣ Geçmiş Mesajları Çek (Müşteri için statü kontrolü ile)
  useEffect(() => {
    if (!chatId) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`http://localhost:5050/api/chats/${chatId}`);
        const data = await res.json();

        // Eğer sohbet kapalıysa müşteriye geçmişi gösterme
        if (data.status === "closed") {
          setMessages([]);
        } else {
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error("Customer fetchMessages error:", err);
      }
    };
    fetchMessages();
  }, [chatId]);

  const handleSend = () => {
    if (!text.trim() || !isReady) return;

    sendMessage({
      chatId,
      senderId: currentUserId,
      senderRole: "customer",
      senderName: currentUserName,
      text,
    });
    setText("");
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      setIsUploading(true);
      const res = await fetch("http://localhost:5050/api/chats/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      sendMessage({
        chatId,
        senderId: currentUserId,
        senderRole: "customer",
        senderName: currentUserName,
        text: `Sent a file: ${data.fileName}`,
        fileUrl: data.fileUrl,
      });
    } catch (err) {
      console.error("Upload error:", err);
    } finally { setIsUploading(false); }
  };

  const handleEndChat = async () => {
    if (!window.confirm("End chat? History will be hidden from your view.")) return;
    try {
      const response = await fetch(`http://localhost:5050/api/chats/${chatId}/close`, { method: "PUT" });
      if (response.ok) {
        setMessages([]);
        setOpen(false);
      }
    } catch (err) { console.error("EndChat error:", err); }
  };

  return (
    <>
      {/* Sohbet Penceresi */}
      {open && isReady && (
        <div style={styles.chatWindow}>
          <div style={styles.header}>
            <span>Live Support</span>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={handleEndChat} style={styles.endChatBtn}>End</button>
              <button onClick={() => setOpen(false)} style={styles.closeBtn}>✕</button>
            </div>
          </div>

          <div style={styles.messages}>
            {messages.map((m, i) => {
              const isImage = m.fileUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(m.fileUrl);
              return (
                <div key={i} style={{
                  ...styles.message,
                  alignSelf: m.senderRole === "customer" ? "flex-end" : "flex-start",
                  backgroundColor: m.senderRole === "customer" ? "#dcf8c6" : "#f1f1f1"
                }}>
                  <b style={{ fontSize: 11 }}>{m.senderName}</b>
                  <div>{m.text}</div>
                  {m.fileUrl && (
                    <div style={{ marginTop: "8px" }}>
                      {isImage ? (
                        <a href={m.fileUrl} target="_blank" rel="noreferrer">
                          <img src={m.fileUrl} alt="attachment" style={styles.imagePreview} />
                        </a>
                      ) : (
                        <a href={m.fileUrl} target="_blank" rel="noreferrer" style={styles.attachmentLink}>
                          📁 View Attachment
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={styles.inputRow}>
            <label htmlFor="file-input" style={styles.fileLabel}>📎</label>
            <input id="file-input" type="file" style={{ display: "none" }} onChange={handleFileChange} disabled={isUploading} />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message..."
              style={styles.input}
              disabled={isUploading}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <button onClick={handleSend} disabled={isUploading} style={styles.sendBtn}>
              {isUploading ? "..." : "Send"}
            </button>
          </div>
        </div>
      )}

      {/* Floating Button (💬) - Her zaman görünür olmalı */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={styles.floatingButton}
        >
          💬
        </button>
      )}
    </>
  );
}

const styles = {
  floatingButton: {
    position: "fixed",
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: "50%",
    background: "#000",
    color: "#fff",
    fontSize: 26,
    border: "none",
    cursor: "pointer",
    zIndex: 9999
  },
  chatWindow: { position: "fixed", bottom: 90, right: 20, width: 320, height: 420, background: "#fff", borderRadius: 12, boxShadow: "0 6px 18px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", zIndex: 9999, overflow: "hidden" },
  header: { padding: "10px 15px", background: "#000", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" },
  closeBtn: { background: "none", border: "none", color: "#fff", fontSize: 18, cursor: "pointer" },
  endChatBtn: { background: "#ff4d4d", border: "none", color: "#fff", fontSize: 11, padding: "4px 8px", borderRadius: "4px", cursor: "pointer" },
  messages: { flex: 1, padding: 10, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, backgroundColor: "#fff" },
  message: { padding: "8px 12px", borderRadius: 10, maxWidth: "80%", wordWrap: "break-word", fontSize: "14px" },
  inputRow: { display: "flex", gap: 6, padding: 10, borderTop: "1px solid #ddd", background: "#f9f9f9", alignItems: "center" },
  input: { flex: 1, padding: "8px", borderRadius: "20px", border: "1px solid #ccc", outline: "none" },
  sendBtn: { padding: "0 15px", borderRadius: "20px", border: "none", background: "#000", color: "#fff", cursor: "pointer", height: "35px" },
  fileLabel: { cursor: "pointer", fontSize: "20px", color: "#666", padding: "0 5px" },
  attachmentLink: { color: "#007bff", fontSize: "12px", display: "block", marginTop: "4px", fontWeight: "bold" },
  imagePreview: { maxWidth: "100%", maxHeight: "150px", borderRadius: "8px", border: "1px solid #ddd", display: "block", margin: "5px auto" }
};

export default CustomerChat;
