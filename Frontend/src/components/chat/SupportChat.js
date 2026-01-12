import { useState, useCallback, useEffect } from "react";
import { useChatSocket } from "../../hooks/useChatSocket";

function SupportChat({ supportUser, chatId, customerName, isChatClosed, onChatDeleted }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  /* ============================================================
     1️⃣ Mesaj Geçmişini Çekme
     ============================================================ */
  useEffect(() => {
    if (!chatId) return;
    
    const token = localStorage.getItem("token");
    setIsLoading(true);
    
    const fetchMessages = async () => {
      try {
        const res = await fetch(`http://localhost:5050/api/chats/${chatId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        
        const data = await res.json();
        setMessages(data.messages || []);
        
      } catch (err) {
        console.error("❌ [Support] fetchMessages error:", err);
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMessages();
  }, [chatId]);

  /* ============================================================
     2️⃣ Sohbeti Tamamen Silme ve Listeden Kaldırma
     ============================================================ */
  const handleClearChat = async () => {
    if (!window.confirm(`${customerName || "Müşteri"} ile olan bu sohbeti tamamen silmek ve listeden kaldırmak istediğinize emin misiniz?`)) return;

    const token = localStorage.getItem("token");
    try {
      // Backend tarafında dökümanı tamamen silen DELETE /api/chats/:chatId rotasını çağırıyoruz
      const res = await fetch(`http://localhost:5050/api/chats/${chatId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok) {
        // Üst bileşene (AdminLiveChatPage) silindiğini haber veriyoruz
        if (onChatDeleted) {
          onChatDeleted(chatId);
        }
      } else {
        const data = await res.json();
        alert(data.message || "Sohbet silinemedi.");
      }
    } catch (err) {
      console.error("❌ Clear chat error:", err);
    }
  };

  /* ============================================================
     3️⃣ Socket ve Mesaj Gönderme
     ============================================================ */
  const handleNewMessage = useCallback((msg) => {
    setMessages((prev) => {
      const isDuplicate = prev.some(
        m => m.timestamp === msg.timestamp && 
             m.text === msg.text &&
             m.senderId === msg.senderId
      );
      if (isDuplicate) return prev;
      return [...prev, msg];
    });
  }, []);

  const { sendMessage } = useChatSocket({
    chatId,
    onMessage: handleNewMessage,
  });

  const handleSend = () => {
    if (!text.trim()) return;
    
    sendMessage({
      chatId,
      senderId: supportUser._id || supportUser.id,
      senderRole: "support",
      senderName: supportUser.name || "Support",
      text,
    });
    setText("");
  };

  return (
    <div style={styles.container}>
      {/* Üst Bilgi Alanı */}
      <div style={styles.headerSection}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18 }}>Live Support</h3>
          <div style={styles.customerInfo}>
            Chatting with: <b>{customerName || "Customer"}</b>
          </div>
          
        </div>
      </div>

      {/* Mesaj Listesi */}
      <div style={styles.messages}>
        {isLoading ? (
          <div style={styles.loadingArea}><div style={styles.spinner}></div></div>
        ) : messages.length === 0 ? (
          <div style={styles.emptyArea}><p>No messages in history.</p></div>
        ) : (
          messages.map((m, i) => {
            const isImage = m.fileUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(m.fileUrl);
            const isFromSupport = m.senderRole === "support";

            return (
              <div key={`${m.timestamp}-${i}`} style={{
                ...styles.messageContainer,
                alignSelf: isFromSupport ? "flex-end" : "flex-start",
              }}>
                <div style={{
                  ...styles.message,
                  background: isFromSupport ? "#d1ecf1" : "#f1f1f1",
                }}>
                  <div style={styles.senderLabel}>{m.senderName}</div>
                  <div style={{ wordBreak: 'break-word' }}>{m.text}</div>
                  
                  {m.fileUrl && (
                    <div style={styles.attachmentArea}>
                      {isImage ? (
                        <img src={m.fileUrl} alt="attachment" style={styles.imagePreview} />
                      ) : (
                        <a href={m.fileUrl} target="_blank" rel="noreferrer" style={styles.fileLink}>📎 View File</a>
                      )}
                    </div>
                  )}
                  <div style={styles.timestamp}>
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Giriş Alanı */}
      <div style={styles.inputRow}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your reply..."
          style={styles.input}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button onClick={handleSend} style={styles.sendButton}>Send</button>
      </div>
    </div>
  );
}

const styles = {
  container: { width: "100%", height: "100%", border: "1px solid #ccc", borderRadius: 8, display: "flex", flexDirection: "column", backgroundColor: "#fff", overflow: "hidden" },
  headerSection: { padding: "15px", borderBottom: "1px solid #eee", backgroundColor: "#f8f9fa" },
  customerInfo: { fontSize: 13, color: "#666", marginTop: 4 },
  statusBadge: { 
    fontSize: "11px", 
    backgroundColor: "#d4edda", 
    color: "#155724", 
    padding: "2px 8px", 
    borderRadius: "12px", 
    fontWeight: "bold",
    marginRight: "10px",
    display: "inline-block"
  },
  clearChatBtn: {
    backgroundColor: "transparent",
    color: "#dc3545",
    border: "none",
    padding: "0",
    textDecoration: "underline",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: "bold",
    transition: "all 0.2s",
    display: "inline-block"
  },
  messages: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: 15 },
  messageContainer: { display: "flex", flexDirection: "column", maxWidth: "75%" },
  message: { padding: "10px 14px", borderRadius: 12, fontSize: "14px", boxShadow: "0 1px 2px rgba(0,0,0,0.1)", position: "relative" },
  senderLabel: { fontSize: "11px", fontWeight: "bold", marginBottom: "4px", color: "#333" },
  timestamp: { fontSize: "10px", color: "#999", marginTop: "4px", textAlign: "right" },
  attachmentArea: { marginTop: "8px", borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: "5px" },
  inputRow: { display: "flex", gap: 8, padding: 12, borderTop: "1px solid #eee", backgroundColor: "#f8f9fa" },
  input: { flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: "14px", outline: "none" },
  sendButton: { padding: "0 24px", background: "#007bff", color: "#fff", border: "none", borderRadius: 8, fontWeight: "600", cursor: "pointer" },
  imagePreview: { maxWidth: "100%", maxHeight: "150px", borderRadius: "4px", marginTop: "5px" },
  fileLink: { color: "#007bff", fontSize: "12px", textDecoration: "none" },
  loadingArea: { textAlign: 'center', marginTop: '30px' },
  emptyArea: { textAlign: 'center', color: '#aaa', marginTop: '30px' },
  spinner: { border: "3px solid #f3f3f3", borderTop: "3px solid #007bff", borderRadius: "50%", width: "20px", height: "20px", animation: "spin 1s linear infinite", margin: "0 auto" }
};

export default SupportChat;