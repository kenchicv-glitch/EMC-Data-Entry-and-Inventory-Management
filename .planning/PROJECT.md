# PROJECT.md

## Project Metadata
- **Project Name**: EMC Retail OS (formerly emc-retail-v2)
- **Current Version**: v2.1
- **Primary Tech Stack**: React, TypeScript, Vite, Supabase, Tailwind CSS.

## Project Summary
EMC Retail OS is a specialized inventory and retail management system designed for multi-branch operations. It features centralized reporting, real-time stock transfers, and role-based access control (RBAC). The project is currently in a stability and quality enhancement phase (v2.1).

## Core Goals
1. **Accuracy**: Ensure the "1275 Profit Rule" and VAT calculations are mathematically sound and consistent across all reports.
2. **Reliability**: Improve system stability, prevent UI freezes during heavy data operations (e.g., inventory search), and ensure real-time synchronization.
3. **Usability**: Standardize modal interactions and UI components for a premium, professional feel.
4. **Maintenance**: Establish a robust codebase map and automated test suite for long-term health.

## Key Modules
- **Sales & POS**: Unified sales entry with tax-inclusive/exclusive reporting.
- **Inventory Management**: Canonical 10-category system for central and branch stocks.
- **Stock Transfers**: Inter-branch coordination with atomic Postgres transactions.
- **Reporting & Analytics**: Dashboards for profit analysis and tax compliance.

## Team & Roles
- **Owner**: Full access to all modules, financial reports, and branch management.
- **Admin**: Access to inventory and operations.
- **Encoder**: Limited access to data entry (Sales, Purchases).

---
*Created: 2026-03-24*
