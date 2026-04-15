import { useCallback } from "react";
import { compressImage } from "./ImageUpload";
import { uploadImg } from "../../services/chat";
import useCustomToast from "../../hooks/useCustomToast";
import { useSelectImageAttach } from "../../routes/CodeChat/ChatTypeAhead/Attach/Hooks/useSelectImageAttach";

export const useUploadRes = () => {
  const { toast, closeAll } = useCustomToast()
  const selectImageHook = useSelectImageAttach()

  const batchUploadRes = useCallback(async (files: File[]) => {
    const tasks = []
    for (const file of files) {
      const formData = new FormData();
      const smallFile = await compressImage(file);
      formData.append('file', smallFile);
      tasks.push(uploadImg(formData))
    }
    if (tasks.length) {
      toast({
        description: '上传文件中...',
        status: 'loading',
        duration: null, // 不自动关闭
        isClosable: false,
        position: 'top'
      });
      Promise.all(tasks)
        .then(res => {
          const imgUrls = res.map((i) => i.url);
          selectImageHook.selectImageAttach(imgUrls);
        }).finally(() => {
          closeAll()
        })
    }
  }, [closeAll, selectImageHook, toast])

  return batchUploadRes
}
