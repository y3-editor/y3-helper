import * as React from 'react';
import {
  Box,
  Image,
  useDisclosure,
  Modal,
  ModalBody,
  ModalContent,
  ModalCloseButton,
  ModalHeader,
} from '@chakra-ui/react';
import Icon from '../Icon';
import { IoCloseCircleOutline, IoEyeOutline } from 'react-icons/io5';
import { proxyImage } from '../../utils';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { ThemeStyle, useTheme } from '../../ThemeContext';

interface ImagePreviewProps {
  url: string;
  w?: string;
  h?: string;
  onRemove?: (url: string) => void;
}

const ImagePreview = (props: ImagePreviewProps) => {
  const { url, w = '12', h = '12', onRemove } = props;
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [hover, setHover] = React.useState(false);
  const { activeTheme } = useTheme();
  return (
    <>
      <Box
        w={w}
        h={h}
        position="relative"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        bg={activeTheme === ThemeStyle.Light ? 'gray.100' : 'gray.700'}
      >
        <Image
          src={proxyImage(url)}
          objectFit="contain"
          alt="img"
          w="full"
          h="full"
        />
        {hover && (
          <Box
            position="absolute"
            top="0"
            right="0"
            bottom="0"
            left="0"
            bg="rgba(0, 0, 0, 0.5)"
            display="flex"
            alignItems="center"
            justifyContent="center"
            onClick={onOpen}
            cursor="pointer"
            w={w}
            h={h}
          >
            <Icon as={IoEyeOutline} color="white" />
          </Box>
        )}
        {onRemove ? (
          <Box
            position="absolute"
            top="-12px"
            right="0"
            w="2"
            h="2"
            zIndex="9"
            _hover={{
              cursor: 'pointer',
            }}
            onClick={() => {
              onRemove(url);
            }}
          >
            <Icon as={IoCloseCircleOutline} />
          </Box>
        ) : null}

        <Modal isOpen={isOpen} onClose={onClose}>
          <ModalContent pb="20px" maxW="100vw" maxH="90vh">
            <ModalHeader fontSize="lg">图片预览</ModalHeader>
            <ModalCloseButton />

            <ModalBody
              w="full"
              h="full"
              display="flex"
              alignItems="center"
              justifyContent="center"
              overflow="auto"
            >
              <TransformWrapper initialScale={1}>
                <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
                  <Box w="full" h="full" display="flex" justifyContent="center">
                    <Image 
                      src={proxyImage(url)} 
                      alt="preview"
                      objectFit="contain"
                      maxW="100%"
                      maxH="65vh"
                    />
                  </Box>
                </TransformComponent>
              </TransformWrapper>
            </ModalBody>
          </ModalContent>
        </Modal>
      </Box>
    </>
  );
};

export default ImagePreview;
