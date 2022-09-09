import { MembershipRole } from "@prisma/client";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Controller, useForm } from "react-hook-form";

import { getPlaceholderAvatar } from "@calcom/lib/getPlaceholderAvatar";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import objectKeys from "@calcom/lib/objectKeys";
import { trpc } from "@calcom/trpc/react";
import { Icon } from "@calcom/ui";
import {
  Button,
  Dialog,
  DialogTrigger,
  Form,
  LinkIconButton,
  showToast,
  TextField,
} from "@calcom/ui/v2/core";
import Avatar from "@calcom/ui/v2/core/Avatar";
import ConfirmationDialogContent from "@calcom/ui/v2/core/ConfirmationDialogContent";
import Meta from "@calcom/ui/v2/core/Meta";
import { Label, TextArea } from "@calcom/ui/v2/core/form/fields";
import { getLayout } from "@calcom/ui/v2/core/layouts/SettingsLayout";

import ImageUploader from "@components/v2/settings/ImageUploader";

interface TeamProfileValues {
  name: string;
  url: string;
  logo: string;
  bio: string;
}

const ProfileView = () => {
  const { t } = useLocale();
  const router = useRouter();
  const utils = trpc.useContext();
  const session = useSession();

  const mutation = trpc.useMutation("viewer.teams.update", {
    onError: (err) => {
      showToast(err.message, "error");
    },
    async onSuccess() {
      await utils.invalidateQueries(["viewer.teams.get"]);
      showToast(t("your_team_updated_successfully"), "success");
    },
  });

  const form = useForm<TeamProfileValues>();

  const { data: team } = trpc.useQuery(["viewer.teams.get", { teamId: Number(router.query.id) }], {
    onError: () => {
      router.push("/settings");
    },
    onSuccess: (team) => {
      if (team) {
        form.setValue("name", team.name || "");
        form.setValue("url", team.slug || "");
        form.setValue("logo", team.logo || "");
        form.setValue("bio", team.bio || "");
      }
    },
  });

  const isAdmin =
    team && (team.membership.role === MembershipRole.OWNER || team.membership.role === MembershipRole.ADMIN);

  const permalink = `${process.env.NEXT_PUBLIC_WEBSITE_URL}/team/${team?.slug}`;

  const deleteTeamMutation = trpc.useMutation("viewer.teams.delete", {
    async onSuccess() {
      await utils.invalidateQueries(["viewer.teams.get"]);
      router.push(`/settings/teams`);
      showToast(t("your_team_updated_successfully"), "success");
    },
  });

  const removeMemberMutation = trpc.useMutation("viewer.teams.removeMember", {
    async onSuccess() {
      await utils.invalidateQueries(["viewer.teams.get"]);
      showToast(t("success"), "success");
    },
    async onError(err) {
      showToast(err.message, "error");
    },
  });

  function deleteTeam() {
    if (team?.id) deleteTeamMutation.mutate({ teamId: team.id });
  }

  function leaveTeam() {
    if (team?.id && session.data)
      removeMemberMutation.mutate({
        teamId: team.id,
        memberId: session.data.user.id,
      });
  }

  return (
    <div>
      <Meta title="profile" description="profile_team_description" />
      {isAdmin ? (
        <Form
          form={form}
          handleSubmit={(values) => {
            if (team) {
              const variables = {
                logo: values.logo,
                name: values.name,
                slug: values.url,
                bio: values.bio,
              };
              objectKeys(variables).forEach((key) => {
                if (variables[key as keyof typeof variables] === team?.[key]) delete variables[key];
              });
              mutation.mutate({ id: team.id, ...variables });
            }
          }}>
          <div className="flex items-center">
            <Controller
              control={form.control}
              name="logo"
              render={({ field: { value } }) => (
                <>
                  <Avatar alt="" imageSrc={getPlaceholderAvatar(value, team?.name as string)} size="lg" />
                  <div className="ml-4">
                    <ImageUploader
                      target="avatar"
                      id="avatar-upload"
                      buttonMsg={t("update")}
                      handleAvatarChange={(newLogo) => {
                        form.setValue("logo", newLogo);
                      }}
                      imageSrc={value}
                    />
                  </div>
                </>
              )}
            />
          </div>

          <hr className="my-8 border-gray-200" />

          <Controller
            control={form.control}
            name="name"
            render={({ field: { value } }) => (
              <div className="mt-8">
                <TextField
                  name="name"
                  label={t("team_name")}
                  value={value}
                  onChange={(e) => {
                    form.setValue("name", e?.target.value);
                  }}
                />
              </div>
            )}
          />
          <Controller
            control={form.control}
            name="url"
            render={({ field: { value } }) => (
              <div className="mt-8">
                <TextField
                  name="url"
                  label={t("team_url")}
                  value={value}
                  addOnLeading="https://cal.com/"
                  onChange={(e) => {
                    form.setValue("url", e?.target.value);
                  }}
                />
              </div>
            )}
          />
          <Controller
            control={form.control}
            name="bio"
            render={({ field: { value } }) => (
              <div className="mt-8">
                <Label>{t("about")}</Label>
                <TextArea
                  name="bio"
                  value={value}
                  className="h-14"
                  onChange={(e) => {
                    form.setValue("bio", e?.target.value);
                  }}
                />
              </div>
            )}
          />
          <p className="mt-2 text-sm text-gray-600">{t("team_description")}</p>
          <Button color="primary" className="mt-8" type="submit" loading={mutation.isLoading}>
            {t("update")}
          </Button>
        </Form>
      ) : (
        <>
          <div>
            <Label className="">{t("team_name")}</Label>
            <p className="text-sm text-black">{team?.name}</p>
          </div>
          {team?.bio && (
            <>
              <Label className="mt-5">{t("about")}</Label>
              <p className="text-sm text-gray-700">{team.bio}</p>
            </>
          )}
          <div className="mt-10 -mb-3 flex">
            <Link href={permalink} passHref={true}>
              <a target="_blank">
                <LinkIconButton Icon={Icon.FiExternalLink}>{t("preview")}</LinkIconButton>
              </a>
            </Link>
            <LinkIconButton
              Icon={Icon.FiLink}
              onClick={() => {
                navigator.clipboard.writeText(permalink);
                showToast("Copied to clipboard", "success");
              }}>
              {t("copy_link_team")}
            </LinkIconButton>
          </div>
        </>
      )}
      <hr className="border-1 my-8 border-gray-200" />

      <div className="mb-3 text-base font-semibold">{t("danger_zone")}</div>
      {team?.membership.role === "OWNER" ? (
        <Dialog>
          <DialogTrigger asChild>
            <Button color="destructive" className="border" StartIcon={Icon.FiTrash2}>
              {t("delete_team")}
            </Button>
          </DialogTrigger>
          <ConfirmationDialogContent
            variety="danger"
            title={t("disband_team")}
            confirmBtnText={t("confirm_disband_team")}
            onConfirm={deleteTeam}>
            {t("disband_team_confirmation_message")}
          </ConfirmationDialogContent>
        </Dialog>
      ) : (
        <Dialog>
          <DialogTrigger asChild>
            <Button color="destructive" className="border" StartIcon={Icon.FiLogOut}>
              {t("leave_team")}
            </Button>
          </DialogTrigger>
          <ConfirmationDialogContent
            variety="danger"
            title={t("leave_team")}
            confirmBtnText={t("confirm_leave_team")}
            onConfirm={leaveTeam}>
            {t("leave_team_confirmation_message")}
          </ConfirmationDialogContent>
        </Dialog>
      )}
    </div>
  );
};

ProfileView.getLayout = getLayout;

export default ProfileView;