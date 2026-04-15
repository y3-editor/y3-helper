import { AttachType } from '../../../../store/attaches';
import { VscBook } from 'react-icons/vsc';
import { FaRegFile, FaRegFolder, FaInternetExplorer } from 'react-icons/fa';
import { HiOutlinePhotograph } from 'react-icons/hi';
import { IoCodeSlash, IoWarningOutline } from 'react-icons/io5';
import Icon from '../../../../components/Icon';
import { IconProps } from '@chakra-ui/react';
import { LuRuler } from 'react-icons/lu';

const AttachIcon = (props: { attachType: AttachType } & IconProps) => {
  const { attachType, ...refs } = props;

  switch (attachType) {
    case AttachType.Docset:
      return <Icon as={VscBook} size="xs" {...refs} />;
    case AttachType.File:
      return <Icon as={FaRegFile} size="xs" {...refs} />;
    case AttachType.CodeBase:
      return <Icon as={IoCodeSlash} size="xs" {...refs} />;
    case AttachType.ImageUrl:
      return <Icon as={HiOutlinePhotograph} size="xs" {...refs} />;
    case AttachType.NetworkModel:
      return <Icon as={FaInternetExplorer} size="xs" {...refs} />;
    case AttachType.Folder:
      return <Icon as={FaRegFolder} size="xs" {...refs} />;
    case AttachType.Problems:
      return <Icon as={IoWarningOutline} size="xs" {...refs} />;
    case AttachType.Rules:
      return <Icon as={LuRuler} size="xs" {...refs} />;
    default:
      return null;
  }
};

export default AttachIcon;
