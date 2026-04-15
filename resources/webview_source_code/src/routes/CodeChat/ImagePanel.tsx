import * as React from 'react';
import { useChatAttach, ImageUrl, IMultiAttachment } from '../../store/chat';
import { IconButton, Box } from '@chakra-ui/react';
import Icon from '../../components/Icon';
import { TbPlus } from 'react-icons/tb';
// import {
//   Input,
//   Modal,
//   ModalBody,
//   ModalCloseButton,
//   ModalContent,
//   ModalFooter,
//   ModalHeader,
//   Button,
// } from '@chakra-ui/react';
// import { IoCloudUploadOutline } from 'react-icons/io5';
// import { uploadImg } from '../../services/chat';
import { AttachType } from '../../store/attaches';
import ImagePreview from '../../components/ImagePreview';
import ImageUpload, {
  HandleImageUpload,
} from '../../components/ImageUpload/ImageUpload';
import { useSelectImageAttach } from './ChatTypeAhead/Attach/Hooks/useSelectImageAttach';

const ImagePanel = () => {
  const selectImageHook = useSelectImageAttach();
  const attachs = useChatAttach((state) => state.attachs);
  const uploadRef = React.useRef<HandleImageUpload | null>(null);

  const imageUrls = React.useMemo(() => {
    if (attachs?.attachType !== AttachType.MultiAttachment) return []
    const imageAttach = ((attachs as IMultiAttachment)?.dataSource||[])?.find(i => i.attachType === AttachType.ImageUrl) as ImageUrl
    return imageAttach?.imgUrls || []
  }, [attachs])

  if (!imageUrls.length) return null

  return (
    <Box display="flex" w="full" gap="2">
      {imageUrls.map((i) => (
        <ImagePreview
          url={i}
          key={i}
          w="8"
          h="8"
          onRemove={(removeUrl) => {
            selectImageHook.removeImageAttach([removeUrl]);
          }}
        />
      ))}
      <IconButton
        aria-label="新增图片"
        title="新增图片"
        size="sm"
        icon={<Icon as={TbPlus} />}
        onClick={() => {
          // setIsOpen(true);
          if (uploadRef.current) {
            uploadRef.current.handleUpload();
          }
        }}
      />
      <ImageUpload ref={uploadRef} />
      {/* <UploadComponent isOpen={isOpen} onClose={onClose} /> */}
    </Box>
  );
};

// const UploadComponent = (props: { isOpen: boolean; onClose: () => void }) => {
//   const { isOpen, onClose } = props;
//   const inputRef = React.useRef<HTMLInputElement | null>(null);
//   const updateImages = useChatAttach((state) => state.update);
//   const [imgUrls, setImgUrls] = React.useState<string[]>([]);

//   const handleFileChange = async (
//     event: React.ChangeEvent<HTMLInputElement>,
//   ) => {
//     const files = event.target.files;
//     if (!files || files.length === 0) return;
//     const promises = [];
//     for (const file of files) {
//       const formData = new FormData();
//       formData.append('file', file);
//       promises.push(uploadImg(formData));
//     }
//     const data = await Promise.all(promises);
//     const imgUrls = data.map((i) => i.url);
//     setImgUrls((prev) => [...prev, ...imgUrls]);
//   };

//   const handleClose = () => {
//     onClose();
//     setImgUrls([]);
//   };

//   return (
//     <Box onClick={(e) => e.stopPropagation()}>
//       <Modal
//         isOpen={isOpen}
//         onClose={() => {
//           handleClose();
//         }}
//       >
//         <ModalContent>
//           <ModalHeader fontSize="lg">上传图片</ModalHeader>
//           <ModalCloseButton />
//           <ModalBody>
//             <Box
//               w="full"
//               border="1px"
//               px="2"
//               py="4"
//               borderColor="customBorder"
//               borderRadius="4px"
//               _hover={{
//                 cursor: 'pointer',
//               }}
//               onClick={() => {
//                 inputRef.current?.click();
//               }}
//             >
//               <Box w="full" display="flex" justifyContent="center">
//                 <Icon as={IoCloudUploadOutline} size="sm" />
//               </Box>
//               <Box fontSize="sm" textAlign="center" mt="2">
//                 支持上传类型为图片，例如：JPEG、PNG、WEBP、GIF 等
//               </Box>
//             </Box>
//             <Box mt="4" display="flex" gap="2">
//               {imgUrls.map((i) => (
//                 <ImagePreview
//                   url={i}
//                   key={i}
//                   w="12"
//                   h="12"
//                   onRemove={(removeUrl) => {
//                     const filterImgUrls = imgUrls.filter(
//                       (url) => url !== removeUrl,
//                     );
//                     setImgUrls(filterImgUrls);
//                   }}
//                 />
//               ))}
//             </Box>
//           </ModalBody>
//           <ModalFooter gap={2}>
//             <Button
//               size="sm"
//               onClick={() => {
//                 handleClose();
//               }}
//             >
//               取消
//             </Button>
//             <Button
//               colorScheme="blue"
//               color="white"
//               type="submit"
//               size="sm"
//               onClick={() => {
//                 updateImages({ attachType: AttachType.ImageUrl, imgUrls });
//                 handleClose();
//               }}
//             >
//               上传
//             </Button>
//           </ModalFooter>
//         </ModalContent>
//       </Modal>
//       <Input
//         ref={inputRef}
//         type="file"
//         onChange={handleFileChange}
//         accept="image/jpeg,image/png,image/webp,image/gif"
//         mb={4}
//         display="none"
//         multiple
//       />
//     </Box>
//   );
// };

export default ImagePanel;
