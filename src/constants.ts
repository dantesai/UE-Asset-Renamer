export const ASSET_TYPE_PREFIXES = [
  'T',
  'SM',
  'SK',
  'AS',
  'DA',
  'DT',
  'S',
  'Cur'
]

export const ASSET_TYPE_PREFIX_LABELS: Record<string, string> = {
  'T': 'Texture',
  'SM': 'StaticMesh',
  'SK': 'SkeletalMesh',
  'AS': 'AnimationSequence',
  'DA': 'DataAsset',
  'DT': 'DataTable',
  'S': 'Sound',
  'Cur': 'Curve'
}

export const VARIANT_OPTIONS = [
  '',
  '01',
  '02',
  '03',
  '04',
  '05',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F'
]

export const TEXTURE_TYPE_MAPPING: Record<string, string> = {
  'basecolor': 'BC',
  'diffuse': 'BC',
  'roughness': 'R',
  'metalness': 'M',
  'metalic': 'M',
  'normal': 'N',
  'height': 'H',
  'ambient': 'AO'
}

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'tga', 'bmp', 'psd', 'exr', 'hdr', 'dds', 'tif', 'tiff']

export const MESH_EXTENSIONS = ['fbx', 'obj', 'gltf', 'glb', 'abc', 'usd', 'usda', 'usdc', 'blend', 'max', 'ma', 'mb']

export const detectAssetTypePrefix = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (IMAGE_EXTENSIONS.includes(ext)) {
    return 'T'
  }
  if (MESH_EXTENSIONS.includes(ext)) {
    return 'SM'
  }
  return ''
}

export const DESCRIPTOR_OPTIONS = [
  { value: '', label: '无' },
  { value: 'BC', label: 'BC' },
  { value: 'RMA', label: 'RMA' },
  { value: 'RMAH', label: 'RMAH' },  
  { value: 'N', label: 'N' }, 
  { value: 'R', label: 'R' },
  { value: 'M', label: 'M' },
  { value: 'AO', label: 'AO' },
  { value: 'E', label: 'E' },
  { value: 'H', label: 'H' },
  { value: 'Dsp', label: 'Dsp' },
  { value: 'MaskA', label: 'MaskA' },     
  { value: 'MaskB', label: 'MaskB' },
  { value: 'MaskC', label: 'MaskC' },
  { value: 'Alpha', label: 'Alpha' },
  { value: 'Spec', label: 'Spec' },
  { value: 'Cur', label: 'Cur' },
  { value: 'ID', label: 'ID' },
  { value: 'Dif', label: 'Dif' }
]

export const detectTextureType = (fileName: string): string => {
  const lowerFileName = fileName.toLowerCase()
  for (const [keyword, descriptor] of Object.entries(TEXTURE_TYPE_MAPPING)) {
    if (lowerFileName.includes(keyword)) {
      return descriptor
    }
  }
  return ''
}

export const generateUE5Name = (rule: { assetTypePrefix: string; assetName: string; descriptor: string; variant: string }): string => {
  const parts = [rule.assetTypePrefix, rule.assetName, rule.descriptor]
  if (rule.variant) {
    parts.push(rule.variant)
  }
  return parts.join('_')
}
