import { Alert } from "@/components/ui/alert";
import { TriangleAlert } from "lucide-react";

type ErrorMessageProps = {
  message: string;
};

export const ErrorMessage = ({ message }: ErrorMessageProps) => (
  <Alert variant="destructive" className="flex items-start gap-2 rounded-xl">
    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
    <span>{message}</span>
  </Alert>
);
