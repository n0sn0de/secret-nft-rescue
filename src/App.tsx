import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileDown,
  FileUp,
  FileText,
  ImageIcon,
  KeyRound,
  Link,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import './App.css'
import {
  APP_NAME,
  APP_VERSION,
  CHAIN_ID,
  DEFAULT_ENDPOINTS,
  EMPTY_COLLECTION_FORM,
  SNAPSHOT_LABEL,
} from './constants'
import { downloadJson } from './lib/download'
import {
  collectionFromForm,
  mergeCollections,
  parseManifestImport,
  shortAddress,
  validateCollectionForm,
} from './lib/manifest'
import {
  checkEndpoint,
  connectWallet,
  errorMessage,
  recoverCollection,
  signOwnerPermit,
} from './lib/secret'
import { loadCollections, saveCollections } from './lib/storage'
import type {
  CollectionForm,
  CollectionManifest,
  CollectionRecovery,
  EndpointHealth,
  RecoveryArchive,
  TokenDossier,
  WalletConnection,
  WalletProviderId,
} from './types'

function App() {
  const [collections, setCollections] = useState<CollectionManifest[]>(() =>
    loadCollections(),
  )
  const [form, setForm] = useState<CollectionForm>(EMPTY_COLLECTION_FORM)
  const [formError, setFormError] = useState('')
  const [selectedEndpointId, setSelectedEndpointId] = useState(
    DEFAULT_ENDPOINTS[0].id,
  )
  const [health, setHealth] = useState<EndpointHealth>({
    state: 'idle',
    detail: 'Not checked',
  })
  const [connection, setConnection] = useState<WalletConnection>()
  const [recoveries, setRecoveries] = useState<CollectionRecovery[]>([])
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const importRef = useRef<HTMLInputElement>(null)

  const selectedEndpoint = useMemo(
    () =>
      DEFAULT_ENDPOINTS.find((endpoint) => endpoint.id === selectedEndpointId) ??
      DEFAULT_ENDPOINTS[0],
    [selectedEndpointId],
  )

  const recoveredTokenCount = recoveries.reduce(
    (total, recovery) => total + recovery.tokens.filter((token) => !token.error).length,
    0,
  )

  const runEndpointCheck = useCallback(async () => {
    setHealth({ state: 'checking', detail: 'Checking LCD' })

    try {
      const network = await checkEndpoint(selectedEndpoint.lcdUrl)
      setHealth({
        state: network === CHAIN_ID ? 'online' : 'offline',
        detail: network === CHAIN_ID ? 'secret-4 online' : `Network: ${network}`,
      })
    } catch (error) {
      setHealth({ state: 'offline', detail: errorMessage(error) })
    }
  }, [selectedEndpoint])

  useEffect(() => {
    saveCollections(collections)
  }, [collections])

  useEffect(() => {
    void runEndpointCheck()
  }, [runEndpointCheck])

  function updateForm(field: keyof CollectionForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
    setFormError('')
  }

  function addCollection() {
    const error = validateCollectionForm(form)
    if (error) {
      setFormError(error)
      return
    }

    const collection = collectionFromForm(form)
    setCollections((current) => mergeCollections(current, [collection]))
    setForm(EMPTY_COLLECTION_FORM)
    setNotice(`Added ${collection.name}.`)
  }

  function removeCollection(id: string) {
    setCollections((current) => current.filter((collection) => collection.id !== id))
    setRecoveries((current) => current.filter((recovery) => recovery.collectionId !== id))
  }

  async function connect(provider: WalletProviderId) {
    setBusy(`Connecting ${provider}`)
    setNotice('')

    try {
      const walletConnection = await connectWallet(provider, selectedEndpoint)
      setConnection(walletConnection)
      setNotice(`Connected ${shortAddress(walletConnection.address)}.`)
    } catch (error) {
      setNotice(errorMessage(error))
    } finally {
      setBusy('')
    }
  }

  async function runRecovery() {
    if (!connection) {
      setNotice('Connect a wallet first.')
      return
    }

    if (collections.length === 0) {
      setNotice('Add or import at least one collection.')
      return
    }

    setBusy('Signing permit')
    setNotice('')
    setRecoveries(
      collections.map((collection) => ({
        collectionId: collection.id,
        contractAddress: collection.contractAddress,
        codeHash: collection.codeHash,
        status: 'queued',
        tokenIds: [],
        tokens: [],
        warnings: [],
      })),
    )

    try {
      const permitBundle = await signOwnerPermit(connection, collections)
      const nextRecoveries: CollectionRecovery[] = []

      for (const collection of collections) {
        setBusy(`Querying ${collection.name}`)
        setRecoveries((current) =>
          current.map((recovery) =>
            recovery.collectionId === collection.id
              ? { ...recovery, status: 'loading' }
              : recovery,
          ),
        )

        try {
          const recovery = await recoverCollection(connection, collection, permitBundle)
          nextRecoveries.push(recovery)
          setRecoveries((current) =>
            current.map((item) =>
              item.collectionId === collection.id ? recovery : item,
            ),
          )
        } catch (error) {
          const failed: CollectionRecovery = {
            collectionId: collection.id,
            contractAddress: collection.contractAddress,
            codeHash: collection.codeHash,
            status: 'error',
            tokenIds: [],
            tokens: [],
            warnings: [],
            error: errorMessage(error),
          }
          nextRecoveries.push(failed)
          setRecoveries((current) =>
            current.map((item) => (item.collectionId === collection.id ? failed : item)),
          )
        }
      }

      setNotice(`Recovery scan complete. ${countRecovered(nextRecoveries)} tokens loaded.`)
    } catch (error) {
      setNotice(errorMessage(error))
    } finally {
      setBusy('')
    }
  }

  function exportArchive() {
    if (!connection) {
      setNotice('Connect a wallet before exporting a recovery archive.')
      return
    }

    const archive: RecoveryArchive = {
      app: {
        name: APP_NAME,
        version: APP_VERSION,
        generatedAt: new Date().toISOString(),
      },
      chain: {
        chainId: CHAIN_ID,
        endpoint: selectedEndpoint.lcdUrl,
      },
      owner: connection.address,
      collections: collections.map((manifest) => ({
        manifest,
        recovery:
          recoveries.find((recovery) => recovery.collectionId === manifest.id) ??
          {
            collectionId: manifest.id,
            contractAddress: manifest.contractAddress,
            codeHash: manifest.codeHash,
            status: 'queued',
            tokenIds: [],
            tokens: [],
            warnings: ['Not queried in this session.'],
          },
      })),
    }

    downloadJson(`secret-nft-rescue-${connection.address}-${Date.now()}.json`, archive)
  }

  function exportManifest() {
    downloadJson('secret-nft-collections.json', {
      collections,
      exportedAt: new Date().toISOString(),
    })
  }

  async function importManifest(file: File | undefined) {
    if (!file) return

    try {
      const imported = parseManifestImport(JSON.parse(await file.text()))
      setCollections((current) => mergeCollections(current, imported))
      setNotice(`Imported ${imported.length} collection records.`)
    } catch (error) {
      setNotice(`Import failed: ${errorMessage(error)}`)
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">secret-4 recovery console</p>
          <h1>{APP_NAME}</h1>
        </div>
        <div className="topbar-actions">
          <StatusPill label={`Target ${SNAPSHOT_LABEL}`} tone="warn" />
          <StatusPill
            label={health.detail}
            tone={health.state === 'online' ? 'good' : health.state === 'offline' ? 'bad' : 'idle'}
          />
        </div>
      </header>

      <section className="control-band">
        <label className="field compact">
          <span>LCD endpoint</span>
          <select
            value={selectedEndpointId}
            onChange={(event) => setSelectedEndpointId(event.target.value)}
          >
            {DEFAULT_ENDPOINTS.map((endpoint) => (
              <option key={endpoint.id} value={endpoint.id}>
                {endpoint.label}
              </option>
            ))}
          </select>
        </label>

        <button className="icon-button" type="button" onClick={() => void runEndpointCheck()}>
          <RefreshCw size={18} />
          Check
        </button>

        <button
          className="primary-button"
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void connect('keplr')}
        >
          <Wallet size={18} />
          Keplr
        </button>

        <button
          className="secondary-button"
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void connect('leap')}
        >
          <Wallet size={18} />
          Leap
        </button>

        <div className="wallet-readout">
          <span>Wallet</span>
          <strong>{connection ? shortAddress(connection.address) : 'Not connected'}</strong>
        </div>
      </section>

      {notice ? <div className="notice">{notice}</div> : null}

      <section className="workspace-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">manifest</p>
              <h2>Collections</h2>
            </div>
            <div className="button-row">
              <input
                ref={importRef}
                className="sr-only"
                type="file"
                accept="application/json"
                onChange={(event) => void importManifest(event.target.files?.[0])}
              />
              <button
                className="icon-button"
                type="button"
                onClick={() => importRef.current?.click()}
                title="Import manifest"
              >
                <FileUp size={18} />
                Import
              </button>
              <button className="icon-button" type="button" onClick={exportManifest}>
                <FileDown size={18} />
                Manifest
              </button>
            </div>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Name</span>
              <input
                value={form.name}
                onChange={(event) => updateForm('name', event.target.value)}
                placeholder="Collection name"
              />
            </label>
            <label className="field wide">
              <span>Contract</span>
              <input
                value={form.contractAddress}
                onChange={(event) => updateForm('contractAddress', event.target.value)}
                placeholder="secret1..."
              />
            </label>
            <label className="field wide">
              <span>Code hash</span>
              <input
                value={form.codeHash}
                onChange={(event) => updateForm('codeHash', event.target.value)}
                placeholder="Optional"
              />
            </label>
            <label className="field wide">
              <span>Token IDs</span>
              <textarea
                value={form.tokenIds}
                onChange={(event) => updateForm('tokenIds', event.target.value)}
                placeholder="Optional fallback list"
                rows={3}
              />
            </label>
            <label className="field wide">
              <span>Notes</span>
              <input
                value={form.notes}
                onChange={(event) => updateForm('notes', event.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>

          <div className="form-actions">
            <button className="primary-button" type="button" onClick={addCollection}>
              <Plus size={18} />
              Add collection
            </button>
            {formError ? <span className="form-error">{formError}</span> : null}
          </div>

          <div className="collection-list">
            {collections.length === 0 ? (
              <div className="empty-state">No collections loaded.</div>
            ) : (
              collections.map((collection) => (
                <article className="collection-row" key={collection.id}>
                  <div>
                    <strong>{collection.name}</strong>
                    <span>{shortAddress(collection.contractAddress)}</span>
                  </div>
                  <div className="collection-meta">
                    <span>{collection.codeHash ? 'hash set' : 'hash lookup'}</span>
                    <span>{collection.tokenIds.length} hints</span>
                  </div>
                  <button
                    className="ghost-icon"
                    type="button"
                    title="Remove collection"
                    onClick={() => removeCollection(collection.id)}
                  >
                    <Trash2 size={17} />
                  </button>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="panel recovery-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">permit query</p>
              <h2>Recovery</h2>
            </div>
            <button
              className="primary-button"
              type="button"
              disabled={Boolean(busy) || collections.length === 0}
              onClick={() => void runRecovery()}
            >
              {busy ? <Loader2 className="spin" size={18} /> : <KeyRound size={18} />}
              {busy || 'Scan NFTs'}
            </button>
          </div>

          <div className="metric-strip">
            <Metric label="Collections" value={collections.length} />
            <Metric label="Token IDs" value={recoveries.reduce((total, item) => total + item.tokenIds.length, 0)} />
            <Metric label="Loaded" value={recoveredTokenCount} />
          </div>

          <div className="recovery-list">
            {recoveries.length === 0 ? (
              <div className="empty-state">Recovery results will appear here.</div>
            ) : (
              recoveries.map((recovery) => {
                const collection = collections.find((item) => item.id === recovery.collectionId)

                return (
                  <article className="recovery-row" key={recovery.collectionId}>
                    <div className="recovery-status">
                      <StatusIcon status={recovery.status} />
                    </div>
                    <div>
                      <strong>{collection?.name ?? shortAddress(recovery.contractAddress)}</strong>
                      <span>
                        {recovery.status === 'complete'
                          ? `${recovery.tokens.length} token records`
                          : recovery.error ?? recovery.status}
                      </span>
                      {recovery.warnings.map((warning) => (
                        <small key={warning}>{warning}</small>
                      ))}
                    </div>
                  </article>
                )
              })
            )}
          </div>

          <div className="token-grid">
            {recoveries.flatMap((recovery) =>
              recovery.tokens.map((token) => (
                <article className="token-card" key={`${recovery.collectionId}-${token.tokenId}`}>
                  <MediaPreview token={token} />
                  <div className="token-body">
                    <strong>{token.name ?? token.tokenId}</strong>
                    <span>{tokenStatus(token)}</span>
                    {token.description ? (
                      <p className="token-description">{token.description}</p>
                    ) : null}
                    {token.attributes.length > 0 ? (
                      <div className="attribute-list">
                        {token.attributes.slice(0, 8).map((attribute) => (
                          <span key={`${attribute.traitType}-${attribute.value}`}>
                            {attribute.traitType}: {attribute.value}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <MetadataLinks token={token} />
                    <MetadataDetails token={token} />
                  </div>
                </article>
              )),
            )}
          </div>

          <div className="export-row">
            <button className="secondary-button" type="button" onClick={exportArchive}>
              <Download size={18} />
              Export archive
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

function StatusPill({ label, tone }: { label: string; tone: 'idle' | 'good' | 'warn' | 'bad' }) {
  return <span className={`status-pill ${tone}`}>{label}</span>
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function StatusIcon({ status }: { status: CollectionRecovery['status'] }) {
  if (status === 'complete') return <CheckCircle2 className="status-icon good" size={20} />
  if (status === 'error') return <XCircle className="status-icon bad" size={20} />
  if (status === 'loading') return <Loader2 className="status-icon spin" size={20} />
  return <AlertTriangle className="status-icon idle" size={20} />
}

function countRecovered(recoveries: CollectionRecovery[]) {
  return recoveries.reduce(
    (total, recovery) => total + recovery.tokens.filter((token) => !token.error).length,
    0,
  )
}

function MediaPreview({ token }: { token: TokenDossier }) {
  if (token.image) {
    return (
      <a className="token-media" href={token.image} target="_blank" rel="noreferrer">
        <img src={token.image} alt={token.name ?? token.tokenId} loading="lazy" />
      </a>
    )
  }

  if (token.animationUrl && isVideoUrl(token.animationUrl)) {
    return (
      <div className="token-media">
        <video controls preload="metadata" src={token.animationUrl} />
      </div>
    )
  }

  if (token.animationUrl) {
    return (
      <a className="token-media empty-media" href={token.animationUrl} target="_blank" rel="noreferrer">
        <ExternalLink size={26} />
      </a>
    )
  }

  return (
    <div className="token-media empty-media">
      <ImageIcon size={30} />
    </div>
  )
}

function MetadataLinks({ token }: { token: TokenDossier }) {
  const links: Array<{ label: string; href: string; icon: ReactNode }> = []

  if (token.tokenUri) {
    links.push({
      label: 'metadata',
      href: token.resolvedMetadata?.gatewayUrl ?? token.tokenUri,
      icon: <FileText size={15} />,
    })
  }

  if (token.image) {
    links.push({
      label: 'art',
      href: token.image,
      icon: <ImageIcon size={15} />,
    })
  }

  if (token.externalUrl) {
    links.push({
      label: 'external',
      href: token.externalUrl,
      icon: <Link size={15} />,
    })
  }

  if (links.length === 0) return null

  return (
    <div className="metadata-links">
      {links.map((item) => (
        <a href={item.href} key={`${item.label}-${item.href}`} target="_blank" rel="noreferrer">
          {item.icon}
          {item.label}
        </a>
      ))}
    </div>
  )
}

function MetadataDetails({ token }: { token: TokenDossier }) {
  const metadata = token.resolvedMetadata?.payload ?? token.privateMetadata ?? token.publicMetadata
  if (!metadata) return null

  return (
    <details className="metadata-details">
      <summary>Metadata JSON</summary>
      <pre>{JSON.stringify(metadata, null, 2)}</pre>
    </details>
  )
}

function tokenStatus(token: TokenDossier) {
  if (token.error) return 'query error'
  if (token.resolvedMetadata?.error) return `metadata error: ${token.resolvedMetadata.error}`
  if (token.resolvedMetadata?.payload) return 'metadata loaded'
  return token.query
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(url)
}

export default App
