// Frontend/src/components/AdminLiveChatPage.js
import React, { useEffect, useMemo, useState } from "react";
import SupportChat from "./chat/SupportChat";

function AdminLiveChatPage({ user }) {
  const [allChats, setAllChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [claimingChatId, setClaimingChatId] = useState(null);

  const token = localStorage.getItem("token");
  const supportAgentId = String(user?._id || user?.id || "");

  const isObjectId = (v) => /^[0-9a-fA-F]{24}$/.test(String(v));

  const fetchChats = async () => {
    try {
      const res = await fetch("http://localhost:5050/api/chats/admin", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      setAllChats(
        (data || []).map((c) => ({
          id: c.customerId,
          name: c.customerName,
          chatId: c.chatId,
          lastText: c.lastText,
          status: c.status || "active",
          lastMessageAt: c.lastMessageAt,
          claimedBy: c.claimedBy || null,
          claimedAt: c.claimedAt || null,
        }))
      );
    } catch (err) {
      console.error("Chat list fetch error:", err);
    }
  };

  useEffect(() => {
    fetchChats();
  }, []);

  const { unclaimedChats, myChats, otherClaimedChats } = useMemo(() => {
    const active = (allChats || []).filter((c) => c.status !== "closed");
    const closed = (allChats || []).filter((c) => c.status === "closed");

    const unclaimed = active.filter((c) => !c.claimedBy);
    const mine = active.filter((c) => c.claimedBy && c.claimedBy === supportAgentId);
    const others = active.filter((c) => c.claimedBy && c.claimedBy !== supportAgentId);

    const minePlusClosed = [
      ...mine,
      ...closed.filter((c) => c.claimedBy && c.claimedBy === supportAgentId),
    ];

    return {
      unclaimedChats: unclaimed,
      myChats: minePlusClosed,
      otherClaimedChats: others,
    };
  }, [allChats, supportAgentId]);

  const handleClaim = async (chat) => {
    if (!chat?.chatId) return;
    if (!supportAgentId) {
      alert("Support agent identity is missing. Please login again.");
      return;
    }

    try {
      setClaimingChatId(chat.chatId);

      // Backend route: PUT /api/chats/admin/:chatId/claim
      const res = await fetch(
        `http://localhost:5050/api/chats/admin/${chat.chatId}/claim`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.message || "Failed to claim chat.");
        return;
      }

      await fetchChats();
      setSelectedChat({ ...chat, claimedBy: supportAgentId });
    } catch (err) {
      console.error("Claim error:", err);
      alert("Failed to claim chat.");
    } finally {
      setClaimingChatId(null);
    }
  };

  const canOpenChat = (chat) => {
    if (!chat) return false;
    if (chat.status === "closed") return true;
    if (!chat.claimedBy) return false;
    if (chat.claimedBy !== supportAgentId) return false;
    return true;
  };

  useEffect(() => {
    if (!selectedChat?.id) return;

    if (!isObjectId(selectedChat.id)) {
      setCustomerDetails({ user: { name: "Guest User" }, orders: [], favorites: [] });
      setLoadingDetails(false);
      return;
    }

    const fetchDetails = async () => {
      try {
        setLoadingDetails(true);

        const res = await fetch(
          `http://localhost:5050/api/chats/user-details/${selectedChat.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setCustomerDetails(null);
          return;
        }

        setCustomerDetails({
          user: data.user,
          orders: data.orders || [],
          favorites: data.favorites || [],
        });
      } catch (err) {
        console.error("Customer details error:", err);
        setCustomerDetails(null);
      } finally {
        setLoadingDetails(false);
      }
    };

    fetchDetails();
  }, [selectedChat, token]);

  return (
    <div style={styles.container}>
      {/* LEFT PANEL */}
      <div style={styles.leftPanel}>
        <h3 style={styles.panelTitle}>Unclaimed Conversations</h3>

        {unclaimedChats.length === 0 ? (
          <div style={styles.emptyStateSmall}>No unclaimed conversations.</div>
        ) : (
          unclaimedChats.map((c) => {
            const isSelected = selectedChat?.chatId === c.chatId;

            return (
              <div
                key={c.chatId}
                style={{
                  ...styles.customerItem,
                  background: isSelected ? "#eef6ff" : "transparent",
                  border: isSelected ? "1px solid #007bff" : "1px solid transparent",
                }}
              >
                <div style={styles.chatRowTop}>
                  <div style={{ fontWeight: "bold" }}>{c.name}</div>
                  <span style={styles.tagActive}>Active</span>
                </div>

                <div style={styles.lastText}>
                  {c.lastText ? c.lastText.substring(0, 30) + "..." : "No messages"}
                </div>

                <button
                  onClick={() => handleClaim(c)}
                  disabled={claimingChatId === c.chatId}
                  style={{
                    ...styles.claimBtn,
                    opacity: claimingChatId === c.chatId ? 0.7 : 1,
                    cursor: claimingChatId === c.chatId ? "not-allowed" : "pointer",
                  }}
                >
                  {claimingChatId === c.chatId ? "Claiming..." : "Claim"}
                </button>
              </div>
            );
          })
        )}

        <hr style={styles.divider} />

        <h3 style={styles.panelTitle}>My Conversations</h3>

        {myChats.length === 0 ? (
          <div style={styles.emptyStateSmall}>No conversations claimed by you.</div>
        ) : (
          myChats.map((c) => {
            const isClosed = c.status === "closed";
            const isSelected = selectedChat?.chatId === c.chatId;

            return (
              <div
                key={c.chatId}
                style={{
                  ...styles.customerItem,
                  background: isSelected ? "#eef6ff" : isClosed ? "#f9f9f9" : "transparent",
                  border: isSelected ? "1px solid #007bff" : "1px solid transparent",
                  opacity: isClosed && !isSelected ? 0.6 : 1,
                }}
                onClick={() => setSelectedChat(c)}
              >
                <div style={styles.chatRowTop}>
                  <div style={{ fontWeight: "bold" }}>{c.name}</div>
                  <span style={isClosed ? styles.tagEnded : styles.tagActive}>
                    {isClosed ? "Ended" : "Active"}
                  </span>
                </div>

                <div style={styles.lastText}>
                  {c.lastText ? c.lastText.substring(0, 30) + "..." : "No messages"}
                </div>
              </div>
            );
          })
        )}

        {otherClaimedChats.length > 0 && (
          <>
            <hr style={styles.divider} />
            <h3 style={styles.panelTitle}>Claimed By Others</h3>
            <div style={styles.emptyStateSmall}>
              Some chats are claimed by other support agents and cannot be opened.
            </div>
          </>
        )}
      </div>

      {/* MIDDLE PANEL */}
      <div style={styles.middlePanel}>
        {selectedChat ? (
          canOpenChat(selectedChat) ? (
            <>
              {selectedChat.status === "closed" && (
                <div style={styles.closedBanner}>This chat has been ended by the customer.</div>
              )}

              <SupportChat
                supportUser={user}
                chatId={selectedChat.chatId}
                customerName={selectedChat.name}
                isChatClosed={selectedChat.status === "closed"}
              />
            </>
          ) : (
            <div style={styles.emptyState}>Please claim this conversation before opening it.</div>
          )
        ) : (
          <div style={styles.emptyState}>Select a chat to view messages.</div>
        )}
      </div>

      {/* RIGHT PANEL */}
      <div style={styles.rightPanel}>
        {loadingDetails ? (
          <div style={styles.emptyState}>Loading customer info...</div>
        ) : customerDetails ? (
          <div>
            <h4 style={styles.sectionTitle}>Customer Profile</h4>
            <div style={styles.profileBox}>
              <p>
                <strong>Name:</strong> {customerDetails.user?.name || "Guest User"}
              </p>
              <p>
                <strong>Email:</strong> {customerDetails.user?.email || "N/A"}
              </p>
              <p>
                <strong>Phone:</strong> {customerDetails.user?.phone || "N/A"}
              </p>
              <p>
                <strong>Address:</strong> {customerDetails.user?.address || "N/A"}
              </p>
            </div>

            <hr style={styles.divider} />

            <h4 style={styles.sectionTitle}>Wishlisted Items</h4>
            {customerDetails.favorites && customerDetails.favorites.length > 0 ? (
              <div style={styles.wishlistList}>
                {customerDetails.favorites.map((p) => (
                  <div key={p.productId} style={styles.wishlistItem}>
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      style={styles.wishlistImg}
                      onError={(e) => {
                        e.target.src = "https://via.placeholder.com/50?text=No+Image";
                      }}
                    />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                      <span style={{ fontSize: 12, color: "#666" }}>
                        {typeof p.price === "number" ? `${p.price} TL` : "Price N/A"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={styles.noOrder}>No wishlist items found.</p>
            )}

            <hr style={styles.divider} />

            <h4 style={styles.sectionTitle}>Order History</h4>
            {customerDetails.orders && customerDetails.orders.length > 0 ? (
              customerDetails.orders.map((o) => (
                <div key={o._id} style={styles.orderCard}>
                  <div style={styles.orderHeader}>
                    <span style={styles.orderId}>
                      Order: {String(o._id).slice(-6).toUpperCase()}
                    </span>
                    <span
                      style={{
                        ...styles.statusTag,
                        backgroundColor:
                          String(o.shippingStatus || "") === "Delivered" ? "#dcf8c6" : "#fff3cd",
                      }}
                    >
                      {o.shippingStatus || "Processing"}
                    </span>
                  </div>

                  <div style={styles.productList}>
                    {(o.items || []).map((item, idx) => (
                      <div key={idx} style={styles.productItem}>
                        <div style={styles.productInfo}>
                          <span style={styles.productName}>{item.name || "Product"}</span>
                          <span style={styles.productQty}>
                            Qty: {item.quantity} | Size: {item.size || "-"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={styles.orderFooter}>
                    <strong>Total: {o.totalAtPurchase ?? o.totalAmount ?? 0} TL</strong>
                  </div>
                </div>
              ))
            ) : (
              <p style={styles.noOrder}>No orders found.</p>
            )}
          </div>
        ) : (
          <div style={styles.emptyState}>Customer details will appear here.</div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    height: "calc(100vh - 80px)",
    marginTop: 80,
    backgroundColor: "#f0f2f5",
  },
  leftPanel: {
    width: 330,
    borderRight: "1px solid #ddd",
    padding: 15,
    backgroundColor: "#fff",
    overflowY: "auto",
  },
  middlePanel: {
    flex: 2,
    padding: 15,
    display: "flex",
    flexDirection: "column",
  },
  rightPanel: {
    width: 380,
    padding: 20,
    borderLeft: "1px solid #ddd",
    backgroundColor: "#fff",
    overflowY: "auto",
  },
  panelTitle: { fontSize: 16, marginBottom: 12, fontWeight: 700 },
  sectionTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 12 },

  customerItem: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    border: "1px solid transparent",
  },

  chatRowTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  tagActive: {
    fontSize: 10,
    padding: "2px 6px",
    borderRadius: 4,
    background: "#28a745",
    color: "#fff",
  },
  tagEnded: {
    fontSize: 10,
    padding: "2px 6px",
    borderRadius: 4,
    background: "#ddd",
    color: "#555",
  },

  lastText: { fontSize: 12, color: "#666", marginTop: 6 },

  claimBtn: {
    marginTop: 10,
    padding: "6px 10px",
    fontSize: 12,
    backgroundColor: "black",
    color: "white",
    border: "none",
    borderRadius: 6,
    width: "100%",
  },

  profileBox: { fontSize: 14, lineHeight: 1.8 },
  divider: { margin: "16px 0", borderTop: "1px solid #eee" },

  wishlistList: { display: "flex", flexDirection: "column", gap: 10 },
  wishlistItem: { display: "flex", gap: 10, alignItems: "center" },
  wishlistImg: {
    width: 50,
    height: 50,
    objectFit: "cover",
    borderRadius: 8,
    border: "1px solid #ddd",
    flexShrink: 0,
  },

  orderCard: {
    padding: 12,
    background: "#f8f9fa",
    borderRadius: 10,
    marginBottom: 15,
    border: "1px solid #eee",
  },
  orderHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  orderId: { fontSize: 13, fontWeight: "bold", color: "#007bff" },
  statusTag: {
    fontSize: 10,
    padding: "3px 8px",
    borderRadius: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  productList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginTop: 10,
  },
  productItem: { display: "flex", gap: 12, alignItems: "flex-start" },
  productInfo: { display: "flex", flexDirection: "column" },
  productName: { fontSize: 13, fontWeight: 600 },
  productQty: { fontSize: 11, color: "#666" },

  orderFooter: {
    textAlign: "right",
    marginTop: 12,
    paddingTop: 10,
    borderTop: "1px dashed #ccc",
  },

  emptyState: {
    padding: 40,
    textAlign: "center",
    color: "#aaa",
  },
  emptyStateSmall: {
    padding: 12,
    textAlign: "center",
    color: "#999",
    fontSize: 12,
  },
  noOrder: { textAlign: "center", color: "#999", fontSize: 13, marginTop: 10 },

  closedBanner: {
    padding: 10,
    background: "#fff3cd",
    color: "#856404",
    marginBottom: 10,
    borderRadius: 5,
    fontSize: 13,
    textAlign: "center",
  },
};

export default AdminLiveChatPage;
