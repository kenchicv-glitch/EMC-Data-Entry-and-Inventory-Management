import { ShoppingCart, Package, Keyboard, MousePointer2, CheckCircle2 } from 'lucide-react';

const GuidePage = () => {
    return (
        <div className="flex-1 overflow-y-auto bg-surface custom-scrollbar">
            <div className="max-w-3xl mx-auto px-8 py-16 text-text-primary">
                {/* Header */}
                <header className="mb-12 border-b border-border-default pb-8">
                    <h1 className="text-4xl font-black mb-4 uppercase tracking-tight">
                        EMC Retail OS: Encoder's Standard Operating Procedure (SOP)
                    </h1>
                    <p className="text-lg text-text-secondary leading-relaxed">
                        Welcome to the EMC Retail OS. This guide is designed to help you navigate and use the system efficiently. It covers the core workflows for sales, inventory, and navigation, along with essential shortcuts to speed up your data entry.
                    </p>
                </header>

                <div className="space-y-12">
                    {/* Section 1 */}
                    <section>
                        <h2 className="text-2xl font-black mb-6 uppercase tracking-wider flex items-center gap-3">
                            <MousePointer2 size={24} className="text-brand-red" /> 1. Getting Started
                        </h2>
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold mb-2">Workspace & Branch Selection</h3>
                                <ul className="list-disc list-inside space-y-2 text-text-secondary ml-4">
                                    <li>Workspaces: Use the sidebar to switch between Systems Overview (Daily Operations), BIR & Compliance (Tax/Reporting), and Owner's Space (Analytics).</li>
                                    <li>Branch Selection: Ensure you are in the correct branch before starting work.</li>
                                    <li>Desktop: Click the branch name in the header top-left.</li>
                                    <li>Mobile: Open the hamburger menu and use the "Switch Branch" selector at the top.</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* Section 2 */}
                    <section>
                        <h2 className="text-2xl font-black mb-6 uppercase tracking-wider flex items-center gap-3">
                            <ShoppingCart size={24} className="text-brand-red" /> 2. Sales Management
                        </h2>
                        <div className="space-y-6 text-text-secondary">
                            <p>Creating sales is the most critical part of your daily task. The interface is optimized for speed and keyboard use.</p>
                            
                            <h3 className="text-lg font-bold text-text-primary mb-2">Quick Entry Workflow</h3>
                            <ol className="list-decimal list-inside space-y-3 ml-4">
                                <li>Open Sales: Press N anywhere to open a New Sale modal.</li>
                                <li>Customer Detail: Type the customer name. Use Arrow keys to navigate results and Enter to select.</li>
                                <li>Adding Items: Type the product name. Use Arrow Down/Up. Press Enter to add.</li>
                                <li>Automatic Focus: The cursor will automatically jump to the Quantity field after adding an item.</li>
                                <li>Finalizing: Click "FINALIZED & DELIVER" or press Ctrl + Enter to complete the transaction.</li>
                            </ol>

                            <div className="p-4 bg-bg-subtle border-l-4 border-brand-red">
                                <p className="font-bold text-text-primary mb-1">Workflow Note</p>
                                <p>The modal closes immediately when you click the close button (X) or press Escape. There are no confirmation prompts for speed.</p>
                            </div>
                        </div>
                    </section>

                    {/* Section 3 */}
                    <section>
                        <h2 className="text-2xl font-black mb-6 uppercase tracking-wider flex items-center gap-3">
                            <Package size={24} className="text-brand-red" /> 3. Inventory Protocol
                        </h2>
                        <div className="space-y-4 text-text-secondary">
                            <h3 className="text-lg font-bold text-text-primary mb-2">Adding/Editing Products</h3>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>Name Structure: Products use a 4-level category structure: L1 {'>'} L2 {'>'} L3 {'>'} L4.</li>
                                <li>Pricing Rules: WSP (Buying Price) must be greater than ₱0. SRP (Selling Price) must be greater than WSP.</li>
                                <li>Validation: The system prevents saving if WSP {'>'}= SRP to prevent losses.</li>
                                <li>Unit Inference: The system automatically suggests a unit (set, box, pc) based on the product name keywords.</li>
                            </ul>
                        </div>
                    </section>

                    {/* Section 4 */}
                    <section>
                        <h2 className="text-2xl font-black mb-6 uppercase tracking-wider flex items-center gap-3">
                            <Keyboard size={24} className="text-brand-red" /> 4. Master Cheat Sheet
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse mb-8">
                                <thead>
                                    <tr className="border-b-2 border-border-default">
                                        <th className="py-3 px-4 text-xs font-black uppercase tracking-widest">Key / Command</th>
                                        <th className="py-3 px-4 text-xs font-black uppercase tracking-widest">Action</th>
                                        <th className="py-3 px-4 text-xs font-black uppercase tracking-widest">Location</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    <tr className="border-b border-border-default hover:bg-bg-subtle">
                                        <td className="py-3 px-4 font-mono font-bold text-brand-red">N</td>
                                        <td className="py-3 px-4 font-bold">New Sale</td>
                                        <td className="py-3 px-4 text-text-muted">Anywhere</td>
                                    </tr>
                                    <tr className="border-b border-border-default hover:bg-bg-subtle">
                                        <td className="py-3 px-4 font-mono font-bold text-brand-red">P</td>
                                        <td className="py-3 px-4 font-bold">New Purchase</td>
                                        <td className="py-3 px-4 text-text-muted">Anywhere</td>
                                    </tr>
                                    <tr className="border-b border-border-default hover:bg-bg-subtle">
                                        <td className="py-3 px-4 font-mono font-bold text-brand-red">Escape</td>
                                        <td className="py-3 px-4 font-bold">Close Modal</td>
                                        <td className="py-3 px-4 text-text-muted">Global</td>
                                    </tr>
                                    <tr className="border-b border-border-default hover:bg-bg-subtle">
                                        <td className="py-3 px-4 font-mono font-bold text-brand-red">F1</td>
                                        <td className="py-3 px-4 font-bold">Focus Search</td>
                                        <td className="py-3 px-4 text-text-muted">Inventory</td>
                                    </tr>
                                    <tr className="border-b border-border-default hover:bg-bg-subtle">
                                        <td className="py-3 px-4 font-mono font-bold text-brand-red">Ctrl + E</td>
                                        <td className="py-3 px-4 font-bold">Save Form</td>
                                        <td className="py-3 px-4 text-text-muted">Modals</td>
                                    </tr>
                                </tbody>
                            </table>

                            <h3 className="text-lg font-bold mb-4">Navigation Shortcuts (ALT + Key)</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { k: 'S', d: 'Sales' },
                                    { k: 'I', d: 'Inventory' },
                                    { k: 'P', d: 'Purchases' },
                                    { k: 'E', d: 'Expenses' },
                                    { k: 'C', d: 'Customers' },
                                    { k: 'U', d: 'Suppliers' },
                                    { k: 'D', d: 'Daily Summary' },
                                    { k: 'H', d: 'Home' }
                                ].map(item => (
                                    <div key={item.k} className="p-3 border border-border-default rounded-xl bg-surface flex flex-col items-center">
                                        <span className="text-[10px] font-black text-text-muted uppercase mb-1">{item.d}</span>
                                        <span className="text-sm font-mono font-black text-brand-red">ALT + {item.k}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Section 5 */}
                    <section className="bg-bg-subtle p-8 border border-border-default rounded-2xl">
                        <h2 className="text-2xl font-black mb-6 uppercase tracking-wider flex items-center gap-3">
                            <CheckCircle2 size={24} className="text-brand-red" /> 5. Best Practices
                        </h2>
                        <ul className="space-y-4 text-text-secondary">
                            <li>Sanitization: The system automatically cleans special characters. Avoid complex symbols in names.</li>
                            <li>Immediate Actions: Modals in this system are designed for speed. Clicking close or ESC will exit immediately.</li>
                            <li>Mobile Usage: Use the Sidebar for all branch switching and navigation on mobile devices.</li>
                            <li>Real-time Sync: Data updates are reflected instantly across all connected branches.</li>
                        </ul>
                    </section>
                </div>

                <footer className="mt-20 pt-10 border-t border-border-default text-center">
                    <p className="text-sm font-black text-text-muted uppercase tracking-[0.4em]">
                        Efficiency equals accuracy. Mastery equals ease.
                    </p>
                    <p className="text-[10px] text-text-muted uppercase mt-4">Document Version: 2.1 | Last Updated: March 2026</p>
                </footer>
            </div>
        </div>
    );
};

export default GuidePage;
