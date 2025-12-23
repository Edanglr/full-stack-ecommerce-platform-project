import { useState, useCallback, useEffect } from "react";
import { useChatSocket } from "../../hooks/useChatSocket";

/*
  Support (Admin / Manager) için chat component’i
*/
function SupportChat({ supportUser, chatId, customerName }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  /* 🔹 1) CHAT AÇILINCA: ESKİ MESAJLARI ÇEK */
  useEffect(() => {
    if (!chatId) return;

    const token = localStorage.getItem("token");

    const fetchMessages = async () => {
      try {
        const res = await fetch(
          `http://localhost:5050/api/chats/${chatId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await res.json();
        setMessages(data.messages || []);
      } catch (err) {
        console.error("fetchMessages error:", err);
      }
    };

    fetchMessages();
  }, [chatId]);

  /* 🔹 2) SOCKET’TEN GELEN YENİ MESAJLAR */
  const handleNewMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const { sendMessage } = useChatSocket({
    chatId,
    onMessage: handleNewMessage,
  });

  /* 🔹 3) ADMIN MESAJ GÖNDER */
  const handleSend = () => {
    if (!text.trim()) return;

    // Support kullanıcısının ismiyle mesaj gönderiyoruz
    sendMessage({
      chatId,
      senderId: supportUser._id || supportUser.id,
      senderRole: "support",
      senderName: supportUser.name || "Support", // Admin ismi Socket'e iletiliyor
      text,
    });

    setText("");
  };

  return (
    <div style={styles.container}>
      <h3 style={{ margin: "0 0 10px 0" }}>Live Support</h3>

      {customerName && (
        <div style={styles.customerInfo}>
          Chatting with: <b>{customerName}</b>
        </div>
      )}

      <div style={styles.messages}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              ...styles.message,
              alignSelf:
                m.senderRole === "support"
                  ? "flex-end"
                  : "flex-start",
              background:
                m.senderRole === "support" ? "#d1ecf1" : "#f1f1f1",
              textAlign: "left"
            }}
          >
            {/* ✅ "customer:" sorununu çözen mantık:
                Eğer senderName varsa (Eda Nur Güler gibi) onu basar, 
                yoksa role bilgisini (support/customer) basar. */}
            <div style={styles.senderLabel}>
              {m.senderRole === "support" 
                ? (m.senderName || "Support") 
                : (m.senderName || "Customer")}
            </div>
            
            <div>{m.text}</div>
          </div>
        ))}
      </div>

      <div style={styles.inputRow}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Reply to customer..."
          style={styles.input}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
        />
        <button onClick={handleSend} style={styles.sendButton}>Send</button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: "100%",
    height: "100%",
    border: "1px solid #ccc",
    borderRadius: 8,
    padding: 15,
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#fff",
  },
  customerInfo: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: "1px solid #eee"
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 10,
    paddingRight: 5
  },
  message: {
    padding: "8px 12px",
    borderRadius: 12,
    maxWidth: "80%",
    fontSize: "14px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
  },
  senderLabel: {
    fontSize: "11px",
    fontWeight: "bold",
    marginBottom: "3px",
    color: "#333",
    display: "block"
  },
  inputRow: {
    display: "flex",
    gap: 8,
    paddingTop: 10,
    borderTop: "1px solid #eee"
  },
  input: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #ddd",
    outline: "none"
  },
  sendButton: {
    padding: "0 20px",
    backgroundColor: "#007bff",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: "bold"
  }
};

export default SupportChat;