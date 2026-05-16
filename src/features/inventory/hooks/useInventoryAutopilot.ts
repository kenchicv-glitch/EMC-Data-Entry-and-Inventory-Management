import { useEffect, useRef, useState } from 'react';
import { runProductMigration, validateHierarchy } from '../services/categoryService';
import { useBranch } from '../../../shared/lib/BranchContext';
import { toast } from 'react-hot-form'; // Assuming existing toast library or similar

export function useInventoryAutopilot() {
  const { currentBranch } = useBranch();
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const processRef = useRef(false);

  useEffect(() => {
    if (hasChecked || isProcessing || processRef.current) return;

    const checkAndSync = async () => {
      try {
        const issues = await validateHierarchy(currentBranch?.id || null);
        
        if (issues.legacyFormat.length > 0) {
          console.log(`[Autopilot] Detected ${issues.legacyFormat.length} legacy products. Starting background sync...`);
          setIsProcessing(true);
          processRef.current = true;
          
          // Small delay to ensure core UI is snappy before background work
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const result = await runProductMigration(currentBranch?.id || null);
          
          if (result.migrated > 0) {
            console.log(`[Autopilot] Successfully normalized ${result.migrated} products.`);
            // Optional: minimal notification or silent success
          }
        }
      } catch (error) {
        console.error('[Autopilot] Background sync failed:', error);
      } finally {
        setIsProcessing(false);
        setHasChecked(true);
        processRef.current = false;
      }
    };

    checkAndSync();
  }, [currentBranch?.id, hasChecked, isProcessing]);

  return { isProcessing };
}
