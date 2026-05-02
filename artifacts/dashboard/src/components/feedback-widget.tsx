import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogDescription,
 DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { MessageCircle } from "lucide-react";

export function FeedbackWidget() {
 const [open, setOpen] = useState(false);
 const [type, setType] = useState("general");
 const [message, setMessage] = useState("");
 const [sending, setSending] = useState(false);

 async function handleSubmit() {
 if (!message.trim()) return;
 setSending(true);
 try {
 const res = await fetch("/api/feedback", {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 type,
 message: message.trim(),
 pageUrl: window.location.pathname,
 }),
 });
 if (!res.ok) throw new Error("Failed");
 toast({ title: "Feedback sent. Thank you!" });
 setMessage("");
 setOpen(false);
 } catch {
 toast({ title: "Failed to send", variant: "destructive" });
 } finally {
 setSending(false);
 }
 }

 return (
 <>
 <button
 onClick={() => setOpen(true)}
 className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 flex items-center justify-center transition-colors"
 title="Send feedback"
 >
 <MessageCircle className="h-5 w-5" />
 </button>

 <Dialog open={open} onOpenChange={setOpen}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Report Issue / Feedback</DialogTitle>
 <DialogDescription>
 Tell us what's working, what's broken, or what you'd like to see.
 </DialogDescription>
 </DialogHeader>
 <div className="space-y-4">
 <div className="space-y-2">
 <Label>Type</Label>
 <Select value={type} onValueChange={setType}>
 <SelectTrigger>
 <SelectValue placeholder="Select type" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="general">General Feedback</SelectItem>
 <SelectItem value="bug">Bug Report</SelectItem>
 <SelectItem value="feature">Feature Request</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label htmlFor="feedbackMessage">Message</Label>
 <Textarea
 id="feedbackMessage"
 placeholder="Describe your issue or suggestion..."
 rows={4}
 value={message}
 onChange={(e) => setMessage(e.target.value)}
 />
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
 <Button onClick={handleSubmit} disabled={sending || !message.trim()}>
 {sending ? "Sending..." : "Send"}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </>
 );
}
