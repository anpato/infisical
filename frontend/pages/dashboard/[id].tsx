import { Fragment, useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useTranslation } from "next-i18next";
import {
  faArrowDownAZ,
  faArrowDownZA,
  faArrowLeft,
  faCheck,
  faClockRotateLeft,
  faEye,
  faEyeSlash,
  faFolderOpen,
  faMagnifyingGlass,
  faPlus,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import getProjectSercetSnapshotsCount from 'ee/api/secrets/GetProjectSercetSnapshotsCount';
import performSecretRollback from 'ee/api/secrets/PerformSecretRollback';
import PITRecoverySidebar from 'ee/components/PITRecoverySidebar';

import Button from '~/components/basic/buttons/Button';
import ListBox from '~/components/basic/Listbox';
import BottonRightPopup from '~/components/basic/popups/BottomRightPopup';
import { useNotificationContext } from '~/components/context/Notifications/NotificationProvider';
import DownloadSecretMenu from '~/components/dashboard/DownloadSecretsMenu';
import DropZone from '~/components/dashboard/DropZone';
import KeyPair from '~/components/dashboard/KeyPair';
import SideBar from '~/components/dashboard/SideBar';
import NavHeader from '~/components/navigation/NavHeader';
import encryptSecrets from '~/components/utilities/secrets/encryptSecrets';
import getSecretsForProject from '~/components/utilities/secrets/getSecretsForProject';
import { getTranslatedServerSideProps } from '~/components/utilities/withTranslateProps';
import guidGenerator from '~/utilities/randomId';

import { envMapping, reverseEnvMapping } from '../../public/data/frequentConstants';
import addSecrets from '../api/files/AddSecrets';
import deleteSecrets from '../api/files/DeleteSecrets';
import updateSecrets from '../api/files/UpdateSecrets';
import getUser from '../api/user/getUser';
import checkUserAction from '../api/userActions/checkUserAction';
import registerUserAction from '../api/userActions/registerUserAction';
import getWorkspaces from '../api/workspace/getWorkspaces';


interface SecretDataProps {
  type: 'personal' | 'shared';
  pos: number;
  key: string;
  value: string;
  id: string;
  comment: string;
}

interface overrideProps {
  id: string;
  keyName: string;
  value: string;
  pos: number;
  comment: string;
}

interface SnapshotProps {
  id: string;
  createdAt: string;
  version: number;
  secretVersions: {
    id: string;
    pos: number;
    type: "personal" | "shared";
    environment: string;
    key: string;
    value: string;
  }[];
}

/**
 * this function finds the teh duplicates in an array
 * @param arr - array of anything (e.g., with secret keys and types (personal/shared))
 * @returns - a list with duplicates
 */
function findDuplicates(arr: any[]) {
  const map = new Map();
  return arr.filter((item) => {
    if (map.has(item)) {
      map.set(item, false);
      return true;
    } else {
      map.set(item, true);
      return false;
    }
  });
}

/**
 * This is the main component for the dashboard (aka the screen with all the encironemnt variable & secrets)
 * @returns
 */
export default function Dashboard() {
  const [data, setData] = useState<SecretDataProps[] | null>();
  const [initialData, setInitialData] = useState<SecretDataProps[]>([]); 
  const [buttonReady, setButtonReady] = useState(false);
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState('');
  const [blurred, setBlurred] = useState(true);
  const [isKeyAvailable, setIsKeyAvailable] = useState(true);
  const [env, setEnv] = useState('Development');
  const [snapshotEnv, setSnapshotEnv] = useState('Development');
  const [isNew, setIsNew] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchKeys, setSearchKeys] = useState('');
  const [errorDragAndDrop, setErrorDragAndDrop] = useState(false);
  const [sortMethod, setSortMethod] = useState('alphabetical');
  const [checkDocsPopUpVisible, setCheckDocsPopUpVisible] = useState(false);
  const [hasUserEverPushed, setHasUserEverPushed] = useState(false);
  const [sidebarSecretId, toggleSidebar] = useState("None");
  const [PITSidebarOpen, togglePITSidebar] = useState(false);
  const [sharedToHide, setSharedToHide] = useState<string[]>([]);
  const [snapshotData, setSnapshotData] = useState<SnapshotProps>();
  const [numSnapshots, setNumSnapshots] = useState<number>();

  const { t } = useTranslation();
  const { createNotification } = useNotificationContext();

  // #TODO: fix save message for changing reroutes
  // const beforeRouteHandler = (url) => {
  // 	const warningText =
  // 		"Do you want to save your results bfore leaving this page?";
  // 	if (!buttonReady) return;
  // 	if (router.asPath !== url && !confirm(warningText)) {
  // 		// router.events.emit('routeChangeError');
  // 		// setData(data)
  // 		savePush();
  // 		throw `Route change to "${url}" was aborted (this error can be safely ignored).`;
  // 	} else {
  // 		setButtonReady(false);
  // 	}
  // };

  // prompt the user if they try and leave with unsaved changes
  useEffect(() => {
    const warningText =
      'Do you want to save your results before leaving this page?';
    const handleWindowClose = (e: any) => {
      if (!buttonReady) return;
      e.preventDefault();
      return (e.returnValue = warningText);
    };
    window.addEventListener('beforeunload', handleWindowClose);
    // router.events.on('routeChangeStart', beforeRouteHandler);
    return () => {
      window.removeEventListener('beforeunload', handleWindowClose);
      // router.events.off('routeChangeStart', beforeRouteHandler);
    };
  }, [buttonReady]);

  /**
   * Reorder rows alphabetically or in the opprosite order
   */
  const reorderRows = (dataToReorder: SecretDataProps[] | 1) => {
    setSortMethod((prevSort) =>
      prevSort == 'alphabetical' ? '-alphabetical' : 'alphabetical'
    );

    sortValuesHandler(dataToReorder, undefined);
  };

  useEffect(() => {
    (async () => {
      try {
        const tempNumSnapshots = await getProjectSercetSnapshotsCount({ workspaceId: String(router.query.id) })
        setNumSnapshots(tempNumSnapshots);
        const userWorkspaces = await getWorkspaces();
        const listWorkspaces = userWorkspaces.map((workspace) => workspace._id);
        if (
          !listWorkspaces.includes(router.asPath.split('/')[2])
        ) {
          router.push('/dashboard/' + listWorkspaces[0]);
        }

        const user = await getUser();
        setIsNew(
          (Date.parse(String(new Date())) - Date.parse(user.createdAt)) / 60000 < 3
            ? true
            : false
        );

        const userAction = await checkUserAction({
          action: 'first_time_secrets_pushed'
        });
        setHasUserEverPushed(userAction ? true : false);
      } catch (error) {
        console.log('Error', error);
        setData(undefined);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        setBlurred(true);
        setWorkspaceId(String(router.query.id));

        const dataToSort = await getSecretsForProject({
          env,
          setIsKeyAvailable,
          setData,
          workspaceId: String(router.query.id)
        });
        setInitialData(dataToSort);
        reorderRows(dataToSort);

        setSharedToHide(
          dataToSort?.filter(row => (dataToSort
          ?.map((item) => item.key)
          .filter(
            (item, index) =>
              index !==
              dataToSort?.map((item) => item.key).indexOf(item)
          ).includes(row.key) && row.type == 'shared'))?.map((item) => item.id)
        )
        setIsLoading(false);
      } catch (error) {
        console.log('Error', error);
        setData(undefined);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env]);

  const addRow = () => {
    setIsNew(false);
    setData([
      ...data!,
      {
        id: guidGenerator(),
        pos: data!.length,
        key: '',
        value: '',
        type: 'shared',
        comment: '',
      }
    ]);
  };

  /**
   * This function add an ovverrided version of a certain secret to the current user
   * @param {object} obj 
   * @param {string} obj.id - if of this secret that is about to be overriden
   * @param {string} obj.keyName - key name of this secret
   * @param {string} obj.value - value of this secret
   * @param {string} obj.pos - position of this secret on the dashboard 
   */
  const addOverride = ({ id, keyName, value, pos, comment }: overrideProps) => {
    setIsNew(false);
    const tempdata: SecretDataProps[] | 1 = [
      ...data!,
      {
        id: id,
        pos: pos,
        key: keyName,
        value: value,
        type: 'personal',
        comment: comment
      }
    ];
    sortValuesHandler(tempdata, sortMethod == "alhpabetical" ? "-alphabetical" : "alphabetical");
  };

  const deleteRow = ({ ids, secretName }: { ids: string[]; secretName: string; }) => {
    setButtonReady(true);
    toggleSidebar("None");
    createNotification({
      text: `${secretName} has been deleted. Remember to save changes.`,
      type: 'error'
    });
    sortValuesHandler(data!.filter((row: SecretDataProps) => !ids.includes(row.id)), sortMethod == "alhpabetical" ? "-alphabetical" : "alphabetical");
  };

  /**
   * This function deleted the override of a certain secrer
   * @param {string} id - id of a shared secret; the override with the same key should be deleted
   */
  const deleteOverride = (id: string) => {
    setButtonReady(true);

    // find which shared secret corresponds to the overriden version
    const sharedVersionOfOverride = data!.filter(secret => secret.type == "shared" && secret.key == data!.filter(row => row.id == id)[0]?.key)[0]?.id;
    
    // change the sidebar to this shared secret; and unhide it
    toggleSidebar(sharedVersionOfOverride)
    setSharedToHide(sharedToHide!.filter(tempId => tempId != sharedVersionOfOverride))

    // resort secrets
    const tempData = data!.filter((row: SecretDataProps) => !(row.key == data!.filter(row => row.id == id)[0]?.key && row.type == 'personal'))
    sortValuesHandler(tempData, sortMethod == "alhpabetical" ? "-alphabetical" : "alphabetical")
  };

  const modifyValue = (value: string, pos: number) => {
    setData((oldData) => {
      oldData![pos].value = value;
      return [...oldData!];
    });
    setButtonReady(true);
  };

  const modifyKey = (value: string, pos: number) => {
    setData((oldData) => {
      oldData![pos].key = value;
      return [...oldData!];
    });
    setButtonReady(true);
  };

  const modifyComment = (value: string, pos: number) => {
    setData((oldData) => {
      oldData![pos].comment = value;
      return [...oldData!];
    });
    setButtonReady(true);
  };

  // For speed purposes and better perforamance, we are using useCallback
  const listenChangeValue = useCallback((value: string, pos: number) => {
    modifyValue(value, pos);
  }, []);

  const listenChangeKey = useCallback((value: string, pos: number) => {
    modifyKey(value, pos);
  }, []);

  const listenChangeComment = useCallback((value: string, pos: number) => {
    modifyComment(value, pos);
  }, []);

  /**
   * Save the changes of environment variables and push them to the database
   */
  const savePush = async (dataToPush?: SecretDataProps[]) => {
    let newData: SecretDataProps[] | null | undefined;
    // dataToPush is mostly used for rollbacks, otherwise we always take the current state data
    if ((dataToPush ?? [])?.length > 0) {
      newData = dataToPush;
    } else {
      newData = data;
    }

    const obj = Object.assign(
      {},
      ...newData!.map((row: SecretDataProps) => ({ [row.type.charAt(0) + row.key]: [row.value, row.comment ?? ''] }))
    );

    // Checking if any of the secret keys start with a number - if so, don't do anything
    const nameErrors = !Object.keys(obj)
      .map((key) => !isNaN(Number(key[0].charAt(0))))
      .every((v) => v === false);
    const duplicatesExist = findDuplicates(data!.map((item: SecretDataProps) => item.key + item.type)).length > 0;

    if (nameErrors) {
      return createNotification({
        text: 'Solve all name errors before saving secrets.',
        type: 'error'
      });
    }

    if (duplicatesExist) {
      return createNotification({
        text: 'Remove duplicated secret names before saving.',
        type: 'error'
      });
    }

    // Once "Save changes" is clicked, disable that button
    setButtonReady(false);

    const secretsToBeDeleted 
      = initialData
      .filter(initDataPoint => !newData!.map(newDataPoint => newDataPoint.id).includes(initDataPoint.id))
      .map(secret => secret.id);

    const secretsToBeAdded 
      = newData!
      .filter(newDataPoint => !initialData.map(initDataPoint => initDataPoint.id).includes(newDataPoint.id));

    const secretsToBeUpdated 
      = newData!.filter(newDataPoint => initialData
      .filter(initDataPoint => newData!.map(newDataPoint => newDataPoint.id).includes(initDataPoint.id) 
        && (newData!.filter(newDataPoint => newDataPoint.id == initDataPoint.id)[0].value != initDataPoint.value
        || newData!.filter(newDataPoint => newDataPoint.id == initDataPoint.id)[0].key != initDataPoint.key
        || newData!.filter(newDataPoint => newDataPoint.id == initDataPoint.id)[0].comment != initDataPoint.comment))
      .map(secret => secret.id).includes(newDataPoint.id));
    
    if (secretsToBeDeleted.length > 0) {
      await deleteSecrets({ secretIds: secretsToBeDeleted });
    }
    if (secretsToBeAdded.length > 0) {
      const secrets = await encryptSecrets({ secretsToEncrypt: secretsToBeAdded, workspaceId, env: envMapping[env] })
      secrets && await addSecrets({ secrets, env: envMapping[env], workspaceId });
    }
    if (secretsToBeUpdated.length > 0) {
      const secrets = await encryptSecrets({ secretsToEncrypt: secretsToBeUpdated, workspaceId, env: envMapping[env] })
      secrets && await updateSecrets({ secrets });
    }

    // If this user has never saved environment variables before, show them a prompt to read docs
    if (!hasUserEverPushed) {
      setCheckDocsPopUpVisible(true);
      await registerUserAction({ action: 'first_time_secrets_pushed' });
    }

    // increasing the number of project commits
    setNumSnapshots((numSnapshots ?? 0) + 1);
  };

  const addData = (newData: SecretDataProps[]) => {
    setData(data!.concat(newData));
    setButtonReady(true);
  };

  const changeBlurred = () => {
    setBlurred(!blurred);
  };

  const sortValuesHandler = (dataToSort: SecretDataProps[] | 1, specificSortMethod?: 'alphabetical' | '-alphabetical') => {
    const howToSort = specificSortMethod == undefined ? sortMethod : specificSortMethod;
    const sortedData = (dataToSort != 1 ? dataToSort : data)!
    .sort((a, b) =>
      howToSort == 'alphabetical'
        ? a.key.localeCompare(b.key)
        : b.key.localeCompare(a.key)
    )
    .map((item: SecretDataProps, index: number) => {
      return {
        ...item,
        pos: index
      };
    });

    setData(sortedData);
  };
  
  const deleteCertainRow = ({ ids, secretName }: { ids: string[]; secretName: string; }) => {
    deleteRow({ids, secretName});
  };

  return data ? (
    <div className="bg-bunker-800 max-h-screen flex flex-col justify-between text-white">
      <Head>
        <title>{t("common:head-title", { title: t("dashboard:title") })}</title>
        <link rel="icon" href="/infisical.ico" />
        <meta property="og:image" content="/images/message.png" />
        <meta property="og:title" content={String(t("dashboard:og-title"))} />
        <meta name="og:description" content={String(t("dashboard:og-description"))} />
      </Head>
      <div className="flex flex-row">
        {sidebarSecretId != "None" && <SideBar 
          toggleSidebar={toggleSidebar} 
          data={data.filter((row: SecretDataProps) => row.key == data.filter(row => row.id == sidebarSecretId)[0]?.key)} 
          modifyKey={listenChangeKey} 
          modifyValue={listenChangeValue} 
          modifyComment={listenChangeComment}
          addOverride={addOverride}
          deleteOverride={deleteOverride}
          buttonReady={buttonReady}
          savePush={savePush}
          sharedToHide={sharedToHide}
          setSharedToHide={setSharedToHide}
          deleteRow={deleteCertainRow}
        />}
        {PITSidebarOpen && <PITRecoverySidebar 
          toggleSidebar={togglePITSidebar} 
          chosenSnapshot={String(snapshotData?.id ? snapshotData.id : "")}
          setSnapshotData={setSnapshotData}
        />}
        <div className="w-full max-h-96 pb-2">
          <NavHeader pageName={t("dashboard:title")} isProjectRelated={true} />
          {checkDocsPopUpVisible && (
            <BottonRightPopup
              buttonText={t("dashboard:check-docs.button")}
              buttonLink="https://infisical.com/docs/getting-started/introduction"
              titleText={t("dashboard:check-docs.title")}
              emoji="🎉"
              textLine1={t("dashboard:check-docs.line1")}
              textLine2={t("dashboard:check-docs.line2")}
              setCheckDocsPopUpVisible={setCheckDocsPopUpVisible}
            />
          )}
          <div className="flex flex-row justify-between items-center mx-6 mt-6 mb-3 text-xl max-w-5xl">
            {snapshotData && 
            <div className={`flex justify-start max-w-sm mt-1 mr-2`}>
              <Button
                text={String(t("Go back to current"))}
                onButtonPressed={() => setSnapshotData(undefined)}
                color="mineshaft"
                size="md"
                icon={faArrowLeft}
              />
            </div>}
            <div className="flex flex-row justify-start items-center text-3xl">
              <div className="font-semibold mr-4 mt-1 flex flex-row items-center">
                <p>{snapshotData ? "Secret Snapshot" : t("dashboard:title")}</p>
                {snapshotData && <span className='bg-primary-800 text-sm ml-4 mt-1 px-1.5 rounded-md'>{new Date(snapshotData.createdAt).toLocaleString()}</span>}
              </div>
              {!snapshotData && data?.length == 0 && (
                <ListBox
                  selected={env}
                  data={['Development', 'Staging', 'Production', 'Testing']}
                  onChange={setEnv}
                />
              )}
            </div>
            <div className="flex flex-row">
              <div className={`flex justify-start max-w-sm mt-1 mr-2`}>
                <Button
                  text={String(numSnapshots + " " + t("Commits"))}
                  onButtonPressed={() => togglePITSidebar(true)}
                  color="mineshaft"
                  size="md"
                  icon={faClockRotateLeft}
                />
              </div>
              {(data?.length !== 0 || buttonReady) && !snapshotData && (
                <div className={`flex justify-start max-w-sm mt-1`}>
                  <Button
                    text={String(t("common:save-changes"))}
                    onButtonPressed={savePush}
                    color="primary"
                    size="md"
                    active={buttonReady}
                    iconDisabled={faCheck}
                    textDisabled={String(t("common:saved"))}
                  />
                </div>
              )}
              {snapshotData && <div className={`flex justify-start max-w-sm mt-1`}>
                <Button
                  text={String(t("Rollback to this snapshot"))}
                  onButtonPressed={async () => {
                    // Update secrets in the state only for the current environment
                    const rolledBackSecrets = snapshotData.secretVersions
                    .filter(row => reverseEnvMapping[row.environment] == env)
                    .map((sv, position) => { 
                      return {
                        id: sv.id, pos: position, type: sv.type, key: sv.key, value: sv.value, comment: ''
                      }
                    });
                    setData(rolledBackSecrets);

                    setSharedToHide(
                      rolledBackSecrets?.filter(row => (rolledBackSecrets
                      ?.map((item) => item.key)
                      .filter(
                        (item, index) =>
                          index !==
                          rolledBackSecrets?.map((item) => item.key).indexOf(item)
                      ).includes(row.key) && row.type == 'shared'))?.map((item) => item.id)
                    )

                    // Perform the rollback globally
                    performSecretRollback({ workspaceId, version: snapshotData.version })

                    setSnapshotData(undefined);
                    createNotification({
                      text: `Rollback has been performed successfully.`,
                      type: 'success'
                    });
                  }}
                  color="primary"
                  size="md"
                  active={buttonReady}
                />
              </div>}
            </div>
          </div>
          <div className="mx-6 w-full pr-12">
            <div className="flex flex-col max-w-5xl pb-1">
              <div className="w-full flex flex-row items-start">
                {(snapshotData || data?.length !== 0) && (
                  <>
                    {!snapshotData 
                    ? <ListBox
                      selected={env}
                      data={['Development', 'Staging', 'Production', 'Testing']}
                      onChange={setEnv}
                    />
                    : <ListBox
                      selected={snapshotEnv}
                      data={['Development', 'Staging', 'Production', 'Testing']}
                      onChange={setSnapshotEnv}
                    />}
                    <div className="h-10 w-full bg-white/5 hover:bg-white/10 ml-2 flex items-center rounded-md flex flex-row items-center">
                      <FontAwesomeIcon
                        className="bg-white/5 rounded-l-md py-3 pl-4 pr-2 text-gray-400"
                        icon={faMagnifyingGlass}
                      />
                      <input
                        className="pl-2 text-gray-400 rounded-r-md bg-white/5 w-full h-full outline-none"
                        value={searchKeys}
                        onChange={(e) => setSearchKeys(e.target.value)}
                        placeholder={String(t("dashboard:search-keys"))}
                      />
                    </div>
                    {!snapshotData && <div className="ml-2 min-w-max flex flex-row items-start justify-start">
                      <Button
                        onButtonPressed={() => reorderRows(1)}
                        color="mineshaft"
                        size="icon-md"
                        icon={
                          sortMethod == 'alphabetical'
                            ? faArrowDownAZ
                            : faArrowDownZA
                        }
                      />
                    </div>}
                    {!snapshotData && <div className="ml-2 min-w-max flex flex-row items-start justify-start">
                      <DownloadSecretMenu data={data} env={env} />
                    </div>}
                    <div className="ml-2 min-w-max flex flex-row items-start justify-start">
                      <Button
                        onButtonPressed={changeBlurred}
                        color="mineshaft"
                        size="icon-md"
                        icon={blurred ? faEye : faEyeSlash}
                      />
                    </div>
                    {!snapshotData && <div className="relative ml-2 min-w-max flex flex-row items-start justify-end">
                      <Button
                        text={String(t("dashboard:add-key"))}
                        onButtonPressed={addRow}
                        color="mineshaft"
                        icon={faPlus}
                        size="md"
                      />
                      {isNew && (
                        <span className="absolute right-0 flex h-3 w-3 items-center justify-center ml-4 mb-4">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/50 opacity-75 h-4 w-4"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                        </span>
                      )}
                    </div>}
                  </>
                )}
              </div>
            </div>
            {isLoading ? (
            <div className="flex items-center justify-center h-full my-48">
              <Image
                src="/images/loading/loading.gif"
                height={60}
                width={100}
                alt="infisical loading indicator"
              ></Image>
            </div> 
            ) : (
            data?.length !== 0 ? (
              <div className="flex flex-col w-full mt-1 mb-2">
                <div
                  className={`max-w-5xl mt-1 max-h-[calc(100vh-280px)] overflow-hidden overflow-y-scroll no-scrollbar no-scrollbar::-webkit-scrollbar`}
                >
                  <div className="px-1 pt-2 bg-mineshaft-800 rounded-md p-2">
                    {!snapshotData && data?.filter(row => row.key?.toUpperCase().includes(searchKeys.toUpperCase()))
                    .filter(row => !(sharedToHide.includes(row.id) && row.type == 'shared')).map((keyPair) => (
                      <KeyPair 
                        key={keyPair.id}
                        keyPair={keyPair}
                        modifyValue={listenChangeValue}
                        modifyKey={listenChangeKey}
                        isBlurred={blurred}
                        isDuplicate={findDuplicates(
                          data?.map((item) => item.key + item.type)
                        )?.includes(keyPair.key + keyPair.type)}
                        toggleSidebar={toggleSidebar}
                        sidebarSecretId={sidebarSecretId}
                        isSnapshot={false}
                      />
                    ))}
                    {snapshotData && snapshotData.secretVersions?.sort((a, b) => a.key.localeCompare(b.key))
                    .filter(row => reverseEnvMapping[row.environment] == snapshotEnv)
                    .filter(row => row.key.toUpperCase().includes(searchKeys.toUpperCase()))
                    .filter(row => !(snapshotData.secretVersions?.filter(row => (snapshotData.secretVersions
                      ?.map((item) => item.key)
                      .filter(
                        (item, index) =>
                          index !==
                          snapshotData.secretVersions?.map((item) => item.key).indexOf(item)
                      ).includes(row.key) && row.type == 'shared'))?.map((item) => item.id).includes(row.id) && row.type == 'shared')).map((keyPair) => (
                      <KeyPair 
                        key={keyPair.id}
                        keyPair={keyPair}
                        modifyValue={listenChangeValue}
                        modifyKey={listenChangeKey}
                        isBlurred={blurred}
                        isDuplicate={findDuplicates(
                          data?.map((item) => item.key + item.type)
                        )?.includes(keyPair.key + keyPair.type)}
                        toggleSidebar={toggleSidebar}
                        sidebarSecretId={sidebarSecretId}
                        isSnapshot={true}
                      />
                    ))}
                  </div>
                  {!snapshotData && <div className="w-full max-w-5xl px-2 pt-3">
                    <DropZone
                      setData={addData}
                      setErrorDragAndDrop={setErrorDragAndDrop}
                      createNewFile={addRow}
                      errorDragAndDrop={errorDragAndDrop}
                      setButtonReady={setButtonReady}
                      keysExist={true}
                      numCurrentRows={data.length}
                    />
                  </div>}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-xl text-gray-400 max-w-5xl mt-28">
                {isKeyAvailable && !snapshotData && (
                  <DropZone
                    setData={setData}
                    setErrorDragAndDrop={setErrorDragAndDrop}
                    createNewFile={addRow}
                    errorDragAndDrop={errorDragAndDrop}
                    setButtonReady={setButtonReady}
                    numCurrentRows={data.length}
                    keysExist={false}
                  />
                )}
                {
                  (!isKeyAvailable && (
                    <>
                      <FontAwesomeIcon
                        className="text-7xl mt-20 mb-8"
                        icon={faFolderOpen}
                      />
                      <p>
                        To view this file, contact your administrator for
                        permission.
                      </p>
                      <p className="mt-1">
                        They need to grant you access in the team tab.
                      </p>
                    </>
                  ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="relative z-10 w-10/12 mr-auto h-full ml-2 bg-bunker-800 flex flex-col items-center justify-center">
      <div className="absolute top-0 bg-bunker h-14 border-b border-mineshaft-700 w-full"></div>
      <Image
        src="/images/loading/loading.gif"
        height={70}
        width={120}
        alt="loading animation"
      ></Image>
    </div>
  );
}

Dashboard.requireAuth = true;

export const getServerSideProps = getTranslatedServerSideProps(["dashboard"]);