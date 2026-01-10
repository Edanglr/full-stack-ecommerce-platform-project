import { useState, useCallback, useEffect } from "react";
import { useChatSocket } from "../../hooks/useChatSocket";

function SupportChat({ supportUser, chatId, customerName, isChatClosed }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  /* ============================================================
     1️⃣ Mesaj Geçmişini Çekme - HER ZAMAN TÜM MESAJLARI GETİR
     ============================================================ */
  useEffect(() => {
    if (!chatId) return;
    
    const token = localStorage.getItem("token");
    setIsLoading(true);
    
    const fetchMessages = async () => {
      try {
        console.log("🔄 [Support] Fetching messages for:", chatId);
        
        const res = await fetch(`http://localhost:5050/api/chats/${chatId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        
        // ✅ KRİTİK: Backend'den gelen tüm mesajları al
        const msgList = data.messages || [];
        
        console.log(`📨 [Support] Fetched ${msgList.length} messages for ${chatId}`);
        setMessages(msgList);
        
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
     2️⃣ Socket Üzerinden Anlık Mesaj Dinleme
     ============================================================ */
  const handleNewMessage = useCallback((msg) => {
    console.log("📩 [Support] New message received:", msg);
    
    setMessages((prev) => {
      // Mükerrer kaydı önlemek için kontrol
      const isDuplicate = prev.some(
        m => m.timestamp === msg.timestamp && 
             m.text === msg.text &&
             m.senderId === msg.senderId
      );
      
      if (isDuplicate) {
        console.log("⚠️ [Support] Duplicate message, skipping");
        return prev;
      }
      
      console.log("✅ [Support] Adding new message");
      return [...prev, msg];
    });
  }, []);

  const { sendMessage } = useChatSocket({
    chatId,
    onMessage: handleNewMessage,
  });

  /* ============================================================
     3️⃣ Mesaj Gönderme
     ============================================================ */
  const handleSend = () => {
    if (!text.trim() || isChatClosed) return;
    
    console.log("📤 [Support] Sending message:", text);
    
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
      <div style={styles.headerSection}>
        <h3 style={{ margin: 0, fontSize: 18 }}>Live Support</h3>
        
        {customerName && (
          <div style={styles.customerInfo}>
            Chatting with: <b>{customerName}</b> 
            {isChatClosed && (
              <span style={{color:'#d9534f', marginLeft: '10px', fontWeight: 'bold', fontSize: 12}}>
                (Chat Ended - History Preserved)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Mesaj Listesi */}
      <div style={styles.messages}>
        {isLoading ? (
          <div style={{ textAlign: 'center', color: '#aaa', marginTop: '30px' }}>
            <div style={styles.spinner}></div>
            <p style={{marginTop: 10, fontSize: 14}}>Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#aaa', marginTop: '30px' }}>
            <div style={{fontSize: 40, marginBottom: 10}}>💬</div>
            <p style={{fontSize: 14}}>No messages yet.</p>
            <p style={{fontSize: 12, color: '#ccc'}}>Start the conversation!</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const isImage = m.fileUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(m.fileUrl);
            const isFromSupport = m.senderRole === "support";

            return (
              <div key={`${m.timestamp}-${i}`} style={{
                ...styles.message,
                alignSelf: isFromSupport ? "flex-end" : "flex-start",
                background: isFromSupport ? "#d1ecf1" : "#f1f1f1",
              }}>
                <div style={styles.senderLabel}>
                  {isFromSupport ? (m.senderName || "Support") : (m.senderName || "Customer")}
                </div>
                <div style={{ wordBreak: 'break-word' }}>{m.text}</div>
                
                {m.fileUrl && (
                  <div style={styles.attachmentArea}>
                    {isImage ? (
                      <a href={m.fileUrl} target="_blank" rel="noreferrer">
                        <img src={m.fileUrl} alt="attachment" style={styles.imagePreview} />
                      </a>
                    ) : (
                      <a href={m.fileUrl} target="_blank" rel="noreferrer" style={styles.fileLink}>
                        📎 View File
                      </a>
                    )}
                  </div>
                )}
                
                {/* Mesaj zamanını göster */}
                <div style={styles.timestamp}>
                  {new Date(m.timestamp).toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Girış Alanı */}
      <div style={styles.inputRow}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isChatClosed ? "Chat is closed, cannot reply." : "Type your reply..."}
          style={{
            ...styles.input, 
            backgroundColor: isChatClosed ? "#f8f9fa" : "#fff",
            cursor: isChatClosed ? "not-allowed" : "text"
          }}
          disabled={isChatClosed}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button 
          onClick={handleSend}
          style={{
            ...styles.sendButton, 
            backgroundColor: isChatClosed ? "#ccc" : "#007bff",
            cursor: isChatClosed ? "not-allowed" : "pointer"
          }} 
          disabled={isChatClosed}
        >
          Send
        </button>
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
    padding: 0,
    display: "flex", 
    flexDirection: "column", 
    backgroundColor: "#fff",
    overflow: "hidden"
  },
  headerSection: {
    padding: "15px",
    borderBottom: "1px solid #eee",
    backgroundColor: "#f8f9fa"
  },
  customerInfo: { 
    fontSize: 13, 
    color: "#666", 
    marginTop: 8
  },
  messages: { 
    flex: 1, 
    overflowY: "auto", 
    display: "flex", 
    flexDirection: "column", 
    gap: 10, 
    padding: 15,
    backgroundColor: "#fff"
  },
  message: { 
    padding: "10px 14px", 
    borderRadius: 12, 
    maxWidth: "75%", 
    fontSize: "14px", 
    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
    position: "relative"
  },
  senderLabel: { 
    fontSize: "11px", 
    fontWeight: "bold", 
    marginBottom: "4px", 
    color: "#333" 
  },
  timestamp: {
    fontSize: "10px",
    color: "#999",
    marginTop: "4px",
    textAlign: "right"
  },
  attachmentArea: { 
    marginTop: "8px", 
    borderTop: "1px solid rgba(0,0,0,0.05)", 
    paddingTop: "5px" 
  },
  inputRow: { 
    display: "flex", 
    gap: 8, 
    padding: 12,
    borderTop: "1px solid #eee",
    backgroundColor: "#f8f9fa"
  },
  input: { 
    flex: 1, 
    padding: "10px 14px", 
    borderRadius: 8, 
    border: "1px solid #ddd", 
    outline: "none",
    fontSize: "14px"
  },
  sendButton: { 
    padding: "0 24px", 
    color: "#fff", 
    border: "none", 
    borderRadius: 8, 
    fontWeight: "600", 
    transition: "0.2s",
    fontSize: "14px",
    cursor: "pointer"
  },
  imagePreview: { 
    maxWidth: "100%", 
    maxHeight: "150px", 
    borderRadius: "4px", 
    marginTop: "5px",
    cursor: "pointer",
    display: "block"
  },
  fileLink: { 
    color: "#007bff", 
    fontSize: "12px", 
    fontWeight: "bold", 
    display: "inline-block", 
    marginTop: "5px",
    textDecoration: "none"
  },
  spinner: {
    border: "3px solid #f3f3f3",
    borderTop: "3px solid #007bff",
    borderRadius: "50%",
    width: "30px",
    height: "30px",
    animation: "spin 1s linear infinite",
    margin: "0 auto"
  }
};

export default SupportChat;