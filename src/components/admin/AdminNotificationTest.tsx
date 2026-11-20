import React from 'react';
import { TestTube } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdminNotificationTestProps {
  testNotifications: () => Promise<void>;
  isTesting: boolean;
}

const AdminNotificationTest: React.FC<AdminNotificationTestProps> = ({
  testNotifications,
  isTesting,
}) => {
  return (
    <>
    {/* Test Button */}
    <div className="mb-8 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-2xl border-2 border-blue-200 dark:border-blue-800 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
            <TestTube className="w-5 h-5" />
            Testar Notificações
          </h3>
          <p className="text-sm text-muted-foreground">
            Envie emails e WhatsApp de teste para verificar se as configurações estão funcionando
          </p>
        </div>
        <Button 
          onClick={testNotifications}
          disabled={isTesting}
          size="lg"
          className="ml-4"
        >
          {isTesting ? '⏳ Testando...' : '🧪 Testar Agora'}
        </Button>
      </div>
    </div>
    </>
  );
};

export default AdminNotificationTest;
