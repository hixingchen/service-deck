import { useState, createContext, useContext } from "react";
import { ChevronDown } from "lucide-react";

interface AccordionContextType {
  openItems: Set<string>;
  toggle: (value: string) => void;
}

const AccordionContext = createContext<AccordionContextType>({
  openItems: new Set(),
  toggle: () => {},
});

interface AccordionProps {
  children: React.ReactNode;
  defaultOpen?: string[];
  className?: string;
}

export function Accordion({ children, defaultOpen = [], className = "" }: AccordionProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set(defaultOpen));

  const toggle = (value: string) => {
    setOpenItems(prev => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  return (
    <AccordionContext.Provider value={{ openItems, toggle }}>
      <div className={`space-y-3 ${className}`}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

interface AccordionItemProps {
  children: React.ReactNode;
  className?: string;
}

export function AccordionItem({ children, className = "" }: AccordionItemProps) {
  return (
    <div className={`rounded-xl border border-border bg-card overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

interface AccordionTriggerProps {
  value: string;
  icon: React.ReactNode;
  title: string;
  description?: string;
}

export function AccordionTrigger({ value, icon, title, description }: AccordionTriggerProps) {
  const { openItems, toggle } = useContext(AccordionContext);
  const isOpen = openItems.has(value);

  return (
    <button
      onClick={() => toggle(value)}
      className="w-full px-5 py-4 flex items-center justify-between hover:bg-card-hover transition-colors"
    >
      <div className="flex items-center gap-3">
        {icon}
        <div className="text-left">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <ChevronDown
        className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
          isOpen ? "rotate-180" : ""
        }`}
      />
    </button>
  );
}

interface AccordionContentProps {
  value: string;
  children: React.ReactNode;
}

export function AccordionContent({ value, children }: AccordionContentProps) {
  const { openItems } = useContext(AccordionContext);
  const isOpen = openItems.has(value);

  if (!isOpen) return null;

  return (
    <div className="px-5 pb-5 pt-2 border-t border-border">
      {children}
    </div>
  );
}
