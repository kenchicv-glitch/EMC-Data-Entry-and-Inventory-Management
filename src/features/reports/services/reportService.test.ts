import { describe, it, expect } from 'vitest';
import { ReportService } from './reportService';

describe('ReportService', () => {
    describe('calculateProfitMetrics', () => {
        it('should correctly calculate the "1275 Profit Rule" (SRP 7650 - COGS 6375 = 1275)', () => {
            // Mock sales data representing "SRP 7650"
            // If the rule says 7650 - 6375 = 1275, it implies 7650 is the Net Revenue.
            // In ReportService, includeVat=true means Revenue = Gross - Discounts.
            const mockSales = [
                {
                    total_price: 7650,
                    vat_amount: 819.64, // Standard 12% VAT for 7650 gross if applicable
                    discount_amount: 0,
                    quantity: 1,
                    cost_price: 6375
                }
            ];

            const metrics = ReportService.calculateProfitMetrics(
                mockSales,
                [], // expenses
                [], // refunds
                [], // returns
                true // includeVat = true (Revenue = Gross)
            );

            expect(metrics.totalRevenue).toBe(7650);
            expect(metrics.totalCOGS).toBe(6375);
            expect(metrics.grossProfit).toBe(1275);
        });

        it('should correctly calculate profit when VAT is excluded', () => {
            const mockSales = [
                {
                    total_price: 1120, // Gross
                    vat_amount: 120,   // 12% VAT
                    discount_amount: 0,
                    quantity: 1,
                    cost_price: 800
                }
            ];

            const metrics = ReportService.calculateProfitMetrics(
                mockSales,
                [], 
                [], 
                [],
                false // includeVat = false (Revenue = Gross - VAT)
            );

            expect(metrics.totalRevenue).toBe(1000); // 1120 - 120
            expect(metrics.totalCOGS).toBe(800);
            expect(metrics.grossProfit).toBe(200);
        });

        it('should handle refunds correctly in profit calculation', () => {
            const mockSales = [{ total_price: 1000, vat_amount: 0, discount_amount: 0, quantity: 1, cost_price: 500 }];
            const mockRefunds = [{ total_price: 200, vat_amount: 0 }];

            const metrics = ReportService.calculateProfitMetrics(
                mockSales,
                [],
                mockRefunds,
                [],
                true
            );

            expect(metrics.totalRevenue).toBe(800); // 1000 - 200
            expect(metrics.grossProfit).toBe(300); // 800 - 500
        });
    });
});
