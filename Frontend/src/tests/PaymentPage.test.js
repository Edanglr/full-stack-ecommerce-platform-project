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
    cart: [
      { productId: "p1", name: "Hoodie", price: 100, size: "M", quantity: 1, image: "x" },
    ],
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
    // saved cards fetch
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ _id: "c1", last4: "4242", expiry: "12/30" }],
    });

    render(<PaymentPage />);

    expect(await screen.findByText(/Payment/i)).toBeInTheDocument();
    expect(await screen.findByText(/Use Saved Card/i)).toBeInTheDocument();
    expect(screen.getByText(/Add New Card/i)).toBeInTheDocument();
    expect(screen.getByText(/4242/i)).toBeInTheDocument();
  });

  test("submits order on Complete Payment", async () => {
    // saved cards fetch -> none
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    // order POST
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ orderId: "o1", invoice: { invoiceNumber: "INV-1" } }),
    });

    render(<PaymentPage />);

    // Switch to new card (no saved cards => it will show form directly)
    fireEvent.change(screen.getByLabelText(/Cardholder Name/i), { target: { value: "Nisa" } });
    fireEvent.change(screen.getByLabelText(/Card Number/i), { target: { value: "4242424242424242" } });
    fireEvent.change(screen.getByLabelText(/Expiry/i), { target: { value: "1230" } });
    fireEvent.change(screen.getByLabelText(/CVV/i), { target: { value: "123" } });

    fireEvent.click(screen.getByText(/Complete Payment/i));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5050/api/orders",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
