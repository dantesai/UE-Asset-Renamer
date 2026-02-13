import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Input, Select, Button, Card, Table, message, Space, Typography, Divider, Row, Col, Checkbox, Radio } from 'antd'
import { FolderOpenOutlined, ReloadOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { Resizable } from 'react-resizable'
import 'react-resizable/css/styles.css'
import './App.css'
import { ASSET_TYPE_PREFIXES, ASSET_TYPE_PREFIX_LABELS, generateUE5Name, detectTextureType, DESCRIPTOR_OPTIONS, detectAssetTypePrefix } from './constants'
import type { FileItem, RenameRule, PreviewItem } from './types'

const { Title, Text } = Typography
const { Option } = Select

interface FileNameWithHighlightProps {
  newName: string
  hasPrefixConflict?: boolean
}

const FileNameWithHighlight: React.FC<FileNameWithHighlightProps> = ({ newName, hasPrefixConflict }) => {
  const [highlightedChars, setHighlightedChars] = useState<Set<number>>(new Set())
  const prevNewNameRef = useRef<string>(newName)

  useEffect(() => {
    if (prevNewNameRef.current !== newName) {
      const prevName = prevNewNameRef.current
      const newHighlighted = new Set<number>()
      
      for (let i = 0; i < newName.length; i++) {
        if (i >= prevName.length || newName[i] !== prevName[i]) {
          newHighlighted.add(i)
        }
      }
      
      if (newHighlighted.size > 0) {
        setHighlightedChars(newHighlighted)
        const timer = setTimeout(() => {
          setHighlightedChars(new Set())
        }, 500)
        prevNewNameRef.current = newName
        return () => clearTimeout(timer)
      }
    }
    prevNewNameRef.current = newName
  }, [newName])

  return (
    <span style={{ fontSize: 11 }}>
      {newName.split('').map((char, index) => (
        <span
          key={index}
          style={{
            color: highlightedChars.has(index) ? '#FF0660' : '#1F1F1F',
            transition: highlightedChars.has(index) ? 'color 0.5s linear' : 'none'
          }}
        >
          {char}
        </span>
      ))}
      {hasPrefixConflict && (
        <span style={{ color: '#E13328', marginLeft: 8 }}>(格式前缀冲突)</span>
      )}
    </span>
  )
}

interface ResizableTitleProps {
  onResize: (e: any, data: { size: { width: number } }) => void
  width: number
  [key: string]: any
}

const ResizableTitle: React.FC<ResizableTitleProps> = (props) => {
  const { onResize, width, ...restProps } = props

  if (!width) {
    return <th {...restProps} />
  }

  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="react-resizable-handle"
          style={{
            position: 'absolute',
            right: -5,
            bottom: 0,
            width: 10,
            height: '100%',
            cursor: 'col-resize',
            zIndex: 1
          }}
          onClick={(e) => e.stopPropagation()}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} />
    </Resizable>
  )
}

function App() {
  const [folderPath, setFolderPath] = useState<string>('')
  const [files, setFiles] = useState<FileItem[]>([])
  const [renameRule, setRenameRule] = useState<RenameRule>({
    assetTypePrefix: 'T',
    assetName: 'name',
    descriptor: '',
    variant: '01',
    autoDetectDescriptor: false
  })
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([])
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [outputMode, setOutputMode] = useState<'original' | 'custom'>('original')
  const [outputPath, setOutputPath] = useState<string>('')
  const [useManualDescriptorGlobal, setUseManualDescriptorGlobal] = useState(false)
  const [forceAutoPrefix, setForceAutoPrefix] = useState(false)
  const [columnWidths, setColumnWidths] = useState(() => {
    const saved = localStorage.getItem('columnWidths')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return [150, 130]
      }
    }
    return [150, 130]
  })
  const selectionsRef = useRef<Map<string, boolean>>(new Map())
  const descriptorsRef = useRef<Map<string, string>>(new Map())
  const manualDescriptorsRef = useRef<Map<string, string>>(new Map())
  const prevFilesRef = useRef<FileItem[]>([])
  const skipNextEffectRef = useRef(false)

  useEffect(() => {
    localStorage.setItem('columnWidths', JSON.stringify(columnWidths))
  }, [columnWidths])

  const handleSelectFolder = async () => {
    const path = await window.electronAPI.selectFolder()
    if (path) {
      setFolderPath(path)
      await loadFiles(path)
    }
  }

  const loadFiles = async (path: string, resetDescriptor: boolean = true, resetSelection: boolean = true) => {
    setLoading(true)
    try {
      const fileList = await window.electronAPI.getFiles(path)
      skipNextEffectRef.current = true
      setFiles(fileList)
      generatePreview(fileList, resetSelection, resetDescriptor)
      prevFilesRef.current = fileList
    } catch (error) {
      message.error('加载文件失败')
    } finally {
      setLoading(false)
    }
  }

  const generatePreview = useCallback((fileList: FileItem[] = files, resetSelection: boolean = false, resetDescriptor: boolean = true) => {
    if (resetSelection) {
      selectionsRef.current.clear()
      fileList.forEach(file => selectionsRef.current.set(file.path, true))
    }
    if (resetDescriptor) {
      descriptorsRef.current.clear()
      manualDescriptorsRef.current.clear()
      fileList.forEach(file => {
        const autoDescriptor = detectTextureType(file.name)
        descriptorsRef.current.set(file.path, autoDescriptor)
      })
    }
    
    const preview: PreviewItem[] = fileList.map(file => {
      const ext = file.name.split('.').pop() || ''
      const autoDescriptor = detectTextureType(file.name)
      const descriptor = descriptorsRef.current.get(file.path) ?? autoDescriptor
      const manualDescriptor = manualDescriptorsRef.current.get(file.path) ?? 'Descriptor'
      const finalDescriptor = useManualDescriptorGlobal ? manualDescriptor : descriptor
      const autoPrefix = detectAssetTypePrefix(file.name)
      const finalPrefix = forceAutoPrefix && autoPrefix ? autoPrefix : renameRule.assetTypePrefix
      const hasPrefixConflict = !forceAutoPrefix && !!autoPrefix && autoPrefix !== renameRule.assetTypePrefix
      
      const newName = generateUE5Name({ ...renameRule, assetTypePrefix: finalPrefix, descriptor: finalDescriptor }) + '.' + ext
      const selected = selectionsRef.current.get(file.path) ?? true
      
      let newPath: string
      if (outputMode === 'custom' && outputPath) {
        newPath = `${outputPath}\\${newName}`
      } else {
        newPath = file.path.replace(file.name, newName)
      }
      
      return {
        originalName: file.name,
        newName,
        originalPath: file.path,
        newPath,
        autoDescriptor,
        descriptor,
        manualDescriptor,
        autoPrefix,
        hasPrefixConflict,
        selected
      }
    })
    setPreviewItems(preview)
  }, [renameRule, outputMode, outputPath, useManualDescriptorGlobal, forceAutoPrefix])

  const handleSelectAll = (checked: boolean) => {
    selectionsRef.current.clear()
    previewItems.forEach(item => selectionsRef.current.set(item.originalPath, checked))
    setPreviewItems(previewItems.map(item => ({ ...item, selected: checked })))
  }

  const handleSelectItem = (originalPath: string, checked: boolean) => {
    selectionsRef.current.set(originalPath, checked)
    setPreviewItems(previewItems.map(item => 
      item.originalPath === originalPath ? { ...item, selected: checked } : item
    ))
  }

  const handleDescriptorChange = useCallback((originalPath: string, descriptor: string) => {
    descriptorsRef.current.set(originalPath, descriptor)
    
    setPreviewItems(prevItems => {
      const item = prevItems.find(i => i.originalPath === originalPath)
      if (!item) return prevItems
      
      const ext = item.originalName.split('.').pop() || ''
      const manualDescriptor = manualDescriptorsRef.current.get(originalPath) ?? ''
      const finalDescriptor = useManualDescriptorGlobal ? manualDescriptor : descriptor
      const autoPrefix = item.autoPrefix || detectAssetTypePrefix(item.originalName)
      const finalPrefix = forceAutoPrefix && autoPrefix ? autoPrefix : renameRule.assetTypePrefix
      const hasPrefixConflict = !forceAutoPrefix && !!autoPrefix && autoPrefix !== renameRule.assetTypePrefix
      const newName = generateUE5Name({ ...renameRule, assetTypePrefix: finalPrefix, descriptor: finalDescriptor }) + '.' + ext
      
      let newPath: string
      if (outputMode === 'custom' && outputPath) {
        newPath = `${outputPath}\\${newName}`
      } else {
        newPath = item.originalPath.replace(item.originalName, newName)
      }
      
      return prevItems.map(i => 
        i.originalPath === originalPath ? { ...i, descriptor, newName, newPath, hasPrefixConflict } : i
      )
    })
  }, [renameRule, outputMode, outputPath, useManualDescriptorGlobal, forceAutoPrefix])

  const handleManualDescriptorChange = useCallback((originalPath: string, manualDescriptor: string) => {
    manualDescriptorsRef.current.set(originalPath, manualDescriptor)
    
    setPreviewItems(prevItems => {
      const item = prevItems.find(i => i.originalPath === originalPath)
      if (!item) return prevItems
      
      const ext = item.originalName.split('.').pop() || ''
      const autoPrefix = item.autoPrefix || detectAssetTypePrefix(item.originalName)
      const finalPrefix = forceAutoPrefix && autoPrefix ? autoPrefix : renameRule.assetTypePrefix
      const hasPrefixConflict = !forceAutoPrefix && !!autoPrefix && autoPrefix !== renameRule.assetTypePrefix
      const newName = generateUE5Name({ ...renameRule, assetTypePrefix: finalPrefix, descriptor: manualDescriptor }) + '.' + ext
      
      let newPath: string
      if (outputMode === 'custom' && outputPath) {
        newPath = `${outputPath}\\${newName}`
      } else {
        newPath = item.originalPath.replace(item.originalName, newName)
      }
      
      return prevItems.map(i => 
        i.originalPath === originalPath ? { ...i, manualDescriptor, newName, newPath, hasPrefixConflict } : i
      )
    })
  }, [renameRule, outputMode, outputPath, forceAutoPrefix])

  useEffect(() => {
    if (skipNextEffectRef.current) {
      skipNextEffectRef.current = false
      return
    }
    
    if (files.length > 0) {
      generatePreview(files, false, false)
    }
  }, [renameRule, files, generatePreview, outputMode, outputPath])

  const handleExecute = async () => {
    const selectedItems = previewItems.filter(item => item.selected)
    
    if (selectedItems.length === 0) {
      message.warning('请先选择要重命名的文件')
      return
    }

    if (outputMode === 'custom' && !outputPath) {
      message.warning('请先选择输出文件夹')
      return
    }

    const newNames = selectedItems.map(item => item.newName)
    const uniqueNewNames = new Set(newNames)
    if (uniqueNewNames.size < newNames.length) {
      message.warning('文件名相同！不执行重命名！')
      return
    }

    setLoading(true)
    try {
      const operations = selectedItems.map(item => {
        const ext = item.originalName.split('.').pop() || ''
        const descriptor = useManualDescriptorGlobal ? (item.manualDescriptor ?? '') : (item.descriptor ?? '')
        const autoPrefix = item.autoPrefix || detectAssetTypePrefix(item.originalName)
        const finalPrefix = forceAutoPrefix && autoPrefix ? autoPrefix : renameRule.assetTypePrefix
        const newName = generateUE5Name({ ...renameRule, assetTypePrefix: finalPrefix, descriptor }) + '.' + ext
        
        let targetPath: string
        if (outputMode === 'custom' && outputPath) {
          targetPath = `${outputPath}\\${newName}`
        } else {
          targetPath = item.originalPath.replace(item.originalName, newName)
        }
        
        return {
          oldPath: item.originalPath,
          newPath: targetPath
        }
      })

      const results = await window.electronAPI.batchRename(operations)

      const failedCount = results.filter(r => !r.success).length
      const successCount = results.filter(r => r.success).length

      if (failedCount === 0) {
        message.success(`成功处理 ${successCount} 个文件`)
        await loadFiles(folderPath, false, false)
      } else {
        message.warning(`成功 ${successCount} 个，失败 ${failedCount} 个`)
        await loadFiles(folderPath, false, false)
      }
    } catch (error) {
      message.error('处理失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectOutputFolder = async () => {
    const path = await window.electronAPI.selectFolder()
    if (path) {
      setOutputPath(path)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    const items = Array.from(e.dataTransfer.items)
    for (const item of items) {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry()
        if (entry && entry.isDirectory) {
          const file = item.getAsFile()
          if (file) {
            const path = (file as any).path
            setFolderPath(path)
            await loadFiles(path)
            break
          }
        }
      }
    }
  }

  const handleResize = (index: number) => (_: any, { size }: { size: { width: number } }) => {
    const newWidths = [...columnWidths]
    const oldWidth = columnWidths[index]
    const delta = size.width - oldWidth
    
    newWidths[index] = size.width
    
    if (index < columnWidths.length - 1) {
      const nextWidth = columnWidths[index + 1] - delta
      if (nextWidth >= 30) {
        newWidths[index + 1] = nextWidth
      }
    }
    
    setColumnWidths(newWidths)
  }

  const columns = [
    {
      title: '选择',
      key: 'select',
      width: 36,
      render: (_: any, record: PreviewItem) => (
        <Checkbox
          checked={record.selected}
          onChange={(e) => handleSelectItem(record.originalPath, e.target.checked)}
        />
      )
    },
    {
      title: '原文件名',
      dataIndex: 'originalName',
      key: 'originalName',
      width: columnWidths[0],
      resizable: true,
      onHeaderCell: () => ({
        width: columnWidths[0],
        onResize: handleResize(0)
      })
    },
    {
      title: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>描述选择</span>
          <Checkbox
            checked={useManualDescriptorGlobal}
            onChange={(e) => setUseManualDescriptorGlobal(e.target.checked)}
            style={{ fontSize: 10 }}
          >
            <span style={{ fontSize: 10 }}>手动</span>
          </Checkbox>
        </div>
      ),
      key: 'descriptorSelect',
      width: columnWidths[1],
      resizable: true,
      onHeaderCell: () => ({
        width: columnWidths[1],
        onResize: handleResize(1)
      }),
      render: (_: any, record: PreviewItem) => (
        useManualDescriptorGlobal ? (
          <Input
            value={record.manualDescriptor ?? ''}
            onChange={(e) => handleManualDescriptorChange(record.originalPath, e.target.value)}
            size="small"
            placeholder="输入描述"
            style={{ fontSize: 11 }}
          />
        ) : (
          <Select
            value={record.descriptor ?? ''}
            onChange={(value) => handleDescriptorChange(record.originalPath, value)}
            style={{ width: '100%' }}
            size="small"
            showSearch
            optionFilterProp="label"
          >
            {DESCRIPTOR_OPTIONS.map(opt => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
        )
      )
    },
    {
      title: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>新文件名预览</span>
          <Checkbox
            checked={forceAutoPrefix}
            onChange={(e) => setForceAutoPrefix(e.target.checked)}
            style={{ fontSize: 10 }}
          >
            <span style={{ fontSize: 10 }}>强制使用原格式前缀识别</span>
          </Checkbox>
        </div>
      ),
      dataIndex: 'newName',
      key: 'newName',
      width: 280,
      render: (_: any, record: PreviewItem) => (
        <FileNameWithHighlight 
          newName={record.newName} 
          hasPrefixConflict={record.hasPrefixConflict}
        />
      )
    },
    {
      title: '状态',
      key: 'status',
      width: 60,
      render: (_: any, record: PreviewItem) => {
        if (record.originalName === record.newName) {
          return <Text type="secondary">无变化</Text>
        }
        return <Text type="success">将重命名</Text>
      }
    }
  ]

  return (
    <div className="app-container">
      <Card className="main-card">
        <Title level={2} style={{ textAlign: 'center', marginBottom: 8, fontSize: 16 }}>
          Unreal Engine 资产导入前重命名工具
        </Title>

        <div
          className={`folder-input-area ${dragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Text strong style={{ fontSize: 12, marginRight: 8, whiteSpace: 'nowrap' }}>输入路径:</Text>
          <Input
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && folderPath) {
                loadFiles(folderPath)
              }
            }}
            placeholder="拖拽文件夹到此处或点击选择文件夹"
            size="large"
            className="folder-input"
          />
          <Button
            type="primary"
            icon={<FolderOpenOutlined />}
            onClick={handleSelectFolder}
            size="large"
            style={{ marginLeft: 6 }}
          >
            选择文件夹
          </Button>
        </div>

        <Divider />

        <div style={{ marginTop: 10 }}>
          <Text strong style={{ fontSize: 12 }}>输出路径: </Text>
          <Radio.Group 
            value={outputMode} 
            onChange={(e) => setOutputMode(e.target.value)}
            style={{ marginLeft: 8 }}
          >
            <Radio value="original">原文件夹</Radio>
            <Radio value="custom">指定文件夹</Radio>
          </Radio.Group>
          {outputMode === 'custom' && (
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <Input
                value={outputPath}
                placeholder="选择输出文件夹"
                size="large"
                readOnly
                style={{ flex: 1 }}
              />
              <Button
                type="primary"
                icon={<FolderOpenOutlined />}
                onClick={handleSelectOutputFolder}
                size="large"
              >
                选择
              </Button>
            </div>
          )}
        </div>

        <Divider />

        <div className="rename-rules">
          <Title level={4} style={{ fontSize: 13 }}>重命名规则 - <span style={{ color: '#8C8C8C' }}>前缀_基础资产名称_变体_后缀</span></Title>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
            说明："name" 可以是 "soldier" ，也可以是"soldier_helmet"，请基于自己的需求灵活使用。
          </Text>
          <Row gutter={8}>
            <Col span={6}>
              <div className="form-item">
                <label>前缀（手动选择）</label>
                <Select
                  value={renameRule.assetTypePrefix}
                  onChange={(value) => setRenameRule({ ...renameRule, assetTypePrefix: value })}
                  style={{ width: '100%' }}
                  size="large"
                >
                  {ASSET_TYPE_PREFIXES.map(prefix => (
                    <Option key={prefix} value={prefix}>
                      {prefix} - {ASSET_TYPE_PREFIX_LABELS[prefix] || prefix}
                    </Option>
                  ))}
                </Select>
              </div>
            </Col>
            <Col span={6}>
              <div className="form-item">
                <label>名称（手动填写）</label>
                <Input
                  value={renameRule.assetName}
                  onChange={(e) => setRenameRule({ ...renameRule, assetName: e.target.value })}
                  placeholder="例如: Soldier"
                  size="large"
                />
              </div>
            </Col>
            <Col span={6}>
              <div className="form-item">
                <label>描述</label>
                <Input
                  value=""
                  placeholder="在文件预览中选择描述"
                  size="large"
                  disabled
                />
              </div>
            </Col>
            <Col span={6}>
              <div className="form-item">
                <label>变体（手动填写）</label>
                <Input
                  value={renameRule.variant}
                  onChange={(e) => setRenameRule({ ...renameRule, variant: e.target.value })}
                  placeholder="例如: 01, A"
                  size="large"
                />
              </div>
            </Col>
          </Row>
        </div>

        <Divider />

        <div className="action-buttons">
          <Space size="small">
            <Button
              icon={<ReloadOutlined />}
              onClick={() => folderPath && loadFiles(folderPath, false, false)}
              disabled={!folderPath}
              loading={loading}
            >
              刷新文件列表
            </Button>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleExecute}
              disabled={previewItems.length === 0 || !renameRule.assetName || !previewItems.some(item => item.selected)}
              loading={loading}
              size="large"
            >
              执行重命名
            </Button>
          </Space>
        </div>

        <Divider />

        <div className="preview-area">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Checkbox
                checked={previewItems.length > 0 && previewItems.every(item => item.selected)}
                indeterminate={previewItems.some(item => item.selected) && !previewItems.every(item => item.selected)}
                onChange={(e) => handleSelectAll(e.target.checked)}
              >
                全选
              </Checkbox>
              <Title level={4} style={{ margin: 0, fontSize: 13 }}>
                文件预览 ({previewItems.length} 个文件，已选 {previewItems.filter(item => item.selected).length} 个)
              </Title>
            </div>
          </div>
          <Table
            columns={columns}
            dataSource={previewItems}
            rowKey="originalPath"
            pagination={{ pageSize: 10, size: 'small' }}
            size="small"
            scroll={{ y: 300 }}
            components={{
              header: {
                cell: ResizableTitle
              }
            }}
          />
        </div>
      </Card>
    </div>
  )
}

export default App
