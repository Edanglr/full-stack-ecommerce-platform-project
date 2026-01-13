import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import PaymentPage from "../components/PaymentPage";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

jest.mock("../context/CartContext", () => ({
  useCart: () => ({
    cart: [{ productId: "p1", name: "Hoodie", price: 100, size: "M", quantity: 1, image: "x" }],
    setCart: jest.fn(),
  }),
}));

beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = jest.fn();
  localStorage.setItem("token", "tkn");
  window.alert = jest.fn();
});

afterEach(() => {
  localStorage.clear();
});

describe("PaymentPage", () => {
  test("fetches saved cards and shows selector when exists", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ _id: "c1", last4: "4242", expiry: "12/30" }],
    });

    render(<PaymentPage />);

    // ✅ "Payment" hem h3 hem butonda geçiyor olabilir => heading’i hedefle
    expect(await screen.findByRole("heading", { name: /Payment/i })).toBeInTheDocument();
    expect(await screen.findByText(/Use Saved Card/i)).toBeInTheDocument();
    expect(screen.getByText(/Add New Card/i)).toBeInTheDocument();
    expect(screen.getByText(/4242/i)).toBeInTheDocument();
  });

  test("submits order on Complete Payment", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [], // saved cards none
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orderId: "o1", invoice: { invoiceNumber: "INV-1" } }), // order POST
      });

    render(<PaymentPage />);

    // ✅ Label-for bağlantısı yok => name attribute ile doldur
    const nameInput = document.querySelector('input[name="cardName"]');
    const numberInput = document.querySelector('input[name="cardNumber"]');
    const expiryInput = document.querySelector('input[name="expiry"]');
    const cvvInput = document.querySelector('input[name="cvv"]');

    fireEvent.change(nameInput, { target: { value: "Nisa" } });
    fireEvent.change(numberInput, { target: { value: "4242424242424242" } });
    fireEvent.change(expiryInput, { target: { value: "1230" } });
    fireEvent.change(cvvInput, { target: { value: "123" } });

    fireEvent.click(screen.getByRole("button", { name: /Complete Payment/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5050/api/orders",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
