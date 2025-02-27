<script>
  import {
    Heading,
    Body,
    Button,
    ButtonGroup,
    Table,
    Layout,
    Modal,
    Search,
    notifications,
    Pagination,
    Divider,
  } from "@budibase/bbui"
  import AddUserModal from "./_components/AddUserModal.svelte"
  import { users, groups, auth } from "stores/portal"
  import { onMount } from "svelte"
  import DeleteRowsButton from "components/backend/DataTable/buttons/DeleteRowsButton.svelte"
  import GroupsTableRenderer from "./_components/GroupsTableRenderer.svelte"
  import AppsTableRenderer from "./_components/AppsTableRenderer.svelte"
  import RoleTableRenderer from "./_components/RoleTableRenderer.svelte"
  import { goto } from "@roxi/routify"
  import OnboardingTypeModal from "./_components/OnboardingTypeModal.svelte"
  import PasswordModal from "./_components/PasswordModal.svelte"
  import InvitedModal from "./_components/InvitedModal.svelte"
  import DeletionFailureModal from "./_components/DeletionFailureModal.svelte"
  import ImportUsersModal from "./_components/ImportUsersModal.svelte"
  import { createPaginationStore } from "helpers/pagination"
  import { get } from "svelte/store"
  import { Constants } from "@budibase/frontend-core"

  let enrichedUsers = []
  let createUserModal,
    inviteConfirmationModal,
    onboardingTypeModal,
    passwordModal,
    importUsersModal,
    deletionFailureModal
  let pageInfo = createPaginationStore()
  let prevEmail = undefined,
    searchEmail = undefined
  let selectedRows = []
  let customRenderers = [
    { column: "userGroups", component: GroupsTableRenderer },
    { column: "apps", component: AppsTableRenderer },
    { column: "role", component: RoleTableRenderer },
  ]

  $: schema = {
    email: {},
    role: {
      sortable: false,
    },
    ...($auth.groupsEnabled && {
      userGroups: { sortable: false, displayName: "Groups" },
    }),
    apps: {},
  }
  $: userData = []
  $: createUsersResponse = { successful: [], unsuccessful: [] }
  $: deleteUsersResponse = { successful: [], unsuccessful: [] }
  $: inviteUsersResponse = { successful: [], unsuccessful: [] }
  $: page = $pageInfo.page
  $: fetchUsers(page, searchEmail)
  $: {
    enrichedUsers = $users.data?.map(user => {
      let userGroups = []
      $groups.forEach(group => {
        if (group.users) {
          group.users?.forEach(y => {
            if (y._id === user._id) {
              userGroups.push(group)
            }
          })
        }
      })
      return {
        ...user,
        name: user.firstName ? user.firstName + " " + user.lastName : "",
        userGroups,
        apps: [...new Set(Object.keys(user.roles))],
      }
    })
  }

  const showOnboardingTypeModal = async addUsersData => {
    userData = await removingDuplicities(addUsersData)
    if (!userData?.users?.length) return

    onboardingTypeModal.show()
  }

  async function createUserFlow() {
    const payload = userData?.users?.map(user => ({
      email: user.email,
      builder: user.role === Constants.BudibaseRoles.Developer,
      admin: user.role === Constants.BudibaseRoles.Admin,
    }))
    try {
      inviteUsersResponse = await users.invite(payload)
      inviteConfirmationModal.show()
    } catch (error) {
      notifications.error("Error inviting user")
    }
  }

  const removingDuplicities = async userData => {
    const currentUserEmails = (await users.fetch())?.map(x => x.email) || []
    const newUsers = []

    for (const user of userData?.users) {
      const { email } = user

      if (
        newUsers.find(x => x.email === email) ||
        currentUserEmails.includes(email)
      )
        continue

      newUsers.push(user)
    }

    if (!newUsers.length) {
      notifications.info("Duplicated! There is no new users to add.")
    }
    return { ...userData, users: newUsers }
  }

  const createUsersFromCsv = async userCsvData => {
    const { userEmails, usersRole, userGroups: groups } = userCsvData

    const users = []
    for (const email of userEmails) {
      const newUser = {
        email: email,
        role: usersRole,
        password: Math.random().toString(36).substring(2, 22),
        forceResetPassword: true,
      }

      users.push(newUser)
    }

    userData = await removingDuplicities({ groups, users })
    if (!userData.users.length) return

    return createUsers()
  }

  async function createUsers() {
    try {
      createUsersResponse = await users.create(
        await removingDuplicities(userData)
      )
      notifications.success("Successfully created user")
      await groups.actions.init()
      passwordModal.show()
    } catch (error) {
      notifications.error("Error creating user")
    }
  }

  async function chooseCreationType(onboardingType) {
    if (onboardingType === "emailOnboarding") {
      createUserFlow()
    } else {
      await createUsers()
    }
  }

  onMount(async () => {
    try {
      await groups.actions.init()
    } catch (error) {
      notifications.error("Error fetching User Group data")
    }
  })

  const deleteRows = async () => {
    try {
      let ids = selectedRows.map(user => user._id)
      if (ids.includes(get(auth).user._id)) {
        notifications.error("You cannot delete yourself")
        return
      }
      deleteUsersResponse = await users.bulkDelete(ids)
      if (deleteUsersResponse.unsuccessful?.length) {
        deletionFailureModal.show()
      } else {
        notifications.success(
          `Successfully deleted ${selectedRows.length} users`
        )
      }

      selectedRows = []
      await fetchUsers(page, searchEmail)
    } catch (error) {
      notifications.error("Error deleting rows")
    }
  }

  async function fetchUsers(page, email) {
    if ($pageInfo.loading) {
      return
    }
    // need to remove the page if they've started searching
    if (email && !prevEmail) {
      pageInfo.reset()
      page = undefined
    }
    prevEmail = email
    try {
      pageInfo.loading()
      await users.search({ page, email })
      pageInfo.fetched($users.hasNextPage, $users.nextPage)
    } catch (error) {
      notifications.error("Error getting user list")
    }
  }
</script>

<Layout noPadding gap="M">
  <Layout gap="XS" noPadding>
    <Heading>Users</Heading>
    <Body>Add users and control who gets access to your published apps</Body>
  </Layout>
  <Divider size="S" />
  <div class="controls">
    <ButtonGroup>
      <Button
        dataCy="add-user"
        on:click={createUserModal.show}
        icon="UserAdd"
        cta>Add users</Button
      >
      <Button
        on:click={importUsersModal.show}
        icon="Import"
        secondary
        newStyles
      >
        Import users
      </Button>
    </ButtonGroup>
    <div class="controls-right">
      <Search bind:value={searchEmail} placeholder="Search email" />
      {#if selectedRows.length > 0}
        <DeleteRowsButton
          item="user"
          on:updaterows
          {selectedRows}
          {deleteRows}
        />
      {/if}
    </div>
  </div>
  <Table
    on:click={({ detail }) => $goto(`./${detail._id}`)}
    {schema}
    bind:selectedRows
    data={enrichedUsers}
    allowEditColumns={false}
    allowEditRows={false}
    allowSelectRows={true}
    showHeaderBorder={false}
    {customRenderers}
  />
  <div class="pagination">
    <Pagination
      page={$pageInfo.pageNumber}
      hasPrevPage={$pageInfo.loading ? false : $pageInfo.hasPrevPage}
      hasNextPage={$pageInfo.loading ? false : $pageInfo.hasNextPage}
      goToPrevPage={pageInfo.prevPage}
      goToNextPage={pageInfo.nextPage}
    />
  </div>
</Layout>

<Modal bind:this={createUserModal}>
  <AddUserModal {showOnboardingTypeModal} />
</Modal>

<Modal bind:this={inviteConfirmationModal}>
  <InvitedModal {inviteUsersResponse} />
</Modal>

<Modal bind:this={onboardingTypeModal}>
  <OnboardingTypeModal {chooseCreationType} />
</Modal>

<Modal bind:this={passwordModal}>
  <PasswordModal {createUsersResponse} userData={userData.users} />
</Modal>

<Modal bind:this={deletionFailureModal}>
  <DeletionFailureModal {deleteUsersResponse} />
</Modal>

<Modal bind:this={importUsersModal}>
  <ImportUsersModal {createUsersFromCsv} />
</Modal>

<style>
  .pagination {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
  }

  .controls {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
  .controls-right {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    align-items: center;
    gap: var(--spacing-xl);
  }
  .controls-right :global(.spectrum-Search) {
    width: 200px;
  }
</style>
