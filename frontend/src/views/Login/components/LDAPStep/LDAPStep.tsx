import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useNotificationContext } from "@app/components/context/Notifications/NotificationProvider";
import { Button, Input } from "@app/components/v2";
import { loginLDAPRedirect } from "@app/hooks/api/auth/queries";

type Props = {
  setStep: (step: number) => void;
};

export const LDAPStep = ({ setStep }: Props) => {
  const { createNotification } = useNotificationContext();
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const { t } = useTranslation();

  // const queryParams = new URLSearchParams(window.location.search);

  const handleSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { nextUrl } = await loginLDAPRedirect({
        organizationSlug,
        username,
        password
      });

      if (!nextUrl) {
        createNotification({
          text: "Login unsuccessful. Double-check your credentials and try again.",
          type: "error"
        });

        return;
      }

      createNotification({
        text: "Successfully logged in",
        type: "success"
      });

      // redirects either to /login/sso or /signup/sso
      window.open(nextUrl);
      window.close();
    } catch (err) {
      createNotification({
        text: "Login unsuccessful. Double-check your credentials and try again.",
        type: "error"
      });
    }

    // TODO: add callback port support

    // const callbackPort = queryParams.get("callback_port");
    // window.open(`/api/v1/ldap/redirect/saml2/${ssoIdentifier}${callbackPort ? `?callback_port=${callbackPort}` : ""}`);
    // window.close();
  };

  return (
    <div className="mx-auto w-full max-w-md md:px-6">
      <p className="mx-auto mb-6 mb-8 flex w-max justify-center bg-gradient-to-b from-white to-bunker-200 bg-clip-text text-center text-xl font-medium text-transparent">
        What&apos;s your LDAP Login?
      </p>
      <form onSubmit={handleSubmission}>
        <div className="relative mx-auto flex max-h-24 w-1/4 w-full min-w-[20rem] items-center justify-center rounded-lg md:max-h-28 md:min-w-[22rem] lg:w-1/6">
          <div className="flex max-h-24 w-full items-center justify-center rounded-lg md:max-h-28">
            <Input
              value={organizationSlug}
              onChange={(e) => setOrganizationSlug(e.target.value)}
              type="text"
              placeholder="Enter your organization slug..."
              isRequired
              autoComplete="email"
              id="email"
              className="h-12"
            />
          </div>
        </div>
        <div className="relative mx-auto mt-2 flex max-h-24 w-1/4 w-full min-w-[20rem] items-center justify-center rounded-lg md:max-h-28 md:min-w-[22rem] lg:w-1/6">
          <div className="flex max-h-24 w-full items-center justify-center rounded-lg md:max-h-28">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              type="text"
              placeholder="Enter your LDAP username..."
              isRequired
              autoComplete="email"
              id="email"
              className="h-12"
            />
          </div>
        </div>
        <div className="relative mx-auto mt-2 flex max-h-24 w-1/4 w-full min-w-[20rem] items-center justify-center rounded-lg md:max-h-28 md:min-w-[22rem] lg:w-1/6">
          <div className="flex max-h-24 w-full items-center justify-center rounded-lg md:max-h-28">
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Enter your LDAP password..."
              isRequired
              autoComplete="current-password"
              id="current-password"
              className="select:-webkit-autofill:focus h-10"
            />
          </div>
        </div>
        <div className="mx-auto mt-4 flex w-1/4 w-full min-w-[20rem] items-center justify-center rounded-md text-center md:min-w-[22rem] lg:w-1/6">
          <Button
            type="submit"
            colorSchema="primary"
            variant="outline_bg"
            isFullWidth
            className="h-14"
          >
            {t("login.login")}
          </Button>
        </div>
      </form>
      <div className="mt-4 flex flex-row items-center justify-center">
        <button
          onClick={() => {
            setStep(0);
          }}
          type="button"
          className="mt-2 cursor-pointer text-sm text-bunker-300 duration-200 hover:text-bunker-200 hover:underline hover:decoration-primary-700 hover:underline-offset-4"
        >
          {t("login.other-option")}
        </button>
      </div>
    </div>
  );
};
