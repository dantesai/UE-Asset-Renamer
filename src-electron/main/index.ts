import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import path from 'path'
import fs from 'fs/promises'

let mainWindow: BrowserWindow | null = null

const isDev = !app.isPackaged

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '帮助',
      submenu: [
        {
          label: 'ue5-style-guide',
          click: async () => {
            await shell.openExternal('https://github.com/thejinchao/ue5-style-guide')
          }
        },
        { type: 'separator' },
        {
          label: '关于 UE Asset Renamer',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: '关于 UE Asset Renamer',
              message: 'UE Asset Renamer - Unreal Engine 资产导入前重命名工具',
              detail: '版本：1.0\n发布时间：2026-02-13\n作者：鸿杰'
            })
          }
        }
      ]
    }
  ]
  
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 770,
    height: 840,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createMenu()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory']
  })
  if (result.canceled) {
    return null
  }
  return result.filePaths[0]
})

ipcMain.handle('get-files', async (_, folderPath: string) => {
  try {
    const files = await fs.readdir(folderPath, { withFileTypes: true })
    const fileList = files
      .filter(file => file.isFile())
      .map(file => ({
        name: file.name,
        path: path.join(folderPath, file.name)
      }))
    return fileList
  } catch (error) {
    throw error
  }
})

ipcMain.handle('rename-file', async (_, oldPath: string, newPath: string) => {
  try {
    await fs.rename(oldPath, newPath)
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('batch-rename', async (_, operations: Array<{ oldPath: string; newPath: string }>) => {
  const results = []
  for (const op of operations) {
    try {
      await fs.rename(op.oldPath, op.newPath)
      results.push({ success: true, oldPath: op.oldPath, newPath: op.newPath })
    } catch (error) {
      results.push({ success: false, error: (error as Error).message, oldPath: op.oldPath })
    }
  }
  return results
})
