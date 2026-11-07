import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import Login from "@/pages/login";
import Landing from "@/pages/landing";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Course from "@/pages/course";
import Quiz from "@/pages/quiz";
import Projects from "@/pages/projects";
import NotFound from "@/pages/not-found";
import Profile from "@/pages/profile";
import Admin from "@/pages/admin-cms";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Cbt from "@/pages/cbt";
import Events from "@/pages/events";
import Messages from "@/pages/messages";
import PartnershipInterestPage from "@/pages/partnership-interest";

const LoginRoute = (props: any) => <Login {...props} />;
const RegisterRoute = (props: any) => <Register {...props} />;

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={LoginRoute} />
      <Route path="/login/admin" component={() => <Login initialMode="staff" />} />
      <Route path="/register" component={RegisterRoute} />
      <Route path="/partners" component={PartnershipInterestPage} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/course/:courseId/module/:moduleId" component={Course} />
      <Route path="/course/:id" component={Course} />
      <Route path="/quiz/:moduleId" component={Quiz} />
      <Route path="/projects" component={Projects} />
      <Route path="/events" component={Events} />
      <Route path="/messages/:conversationId" component={Messages} />
      <Route path="/messages" component={Messages} />
      <Route path="/cbt/attempt/:attemptId" component={Cbt} />
      <Route path="/cbt" component={Cbt} />
      <Route path="/profile" component={Profile} />
      <Route path="/admin" component={Admin} />
      <Route path="/courses" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
