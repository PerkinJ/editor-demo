/**
 * @file å¤çç»å¸åçæä½
 */

import * as React from "react";
import * as _ from "lodash";
import * as uuid from "uuid";
import { ReScreen } from "regraph-next";
import { ZoomTransform, zoomIdentity } from "d3-zoom";
import { Menu } from "antd";
import { EditorNode } from "./EditorNode";
import { EditorEdges } from "./EditorEdges";
import { ContextMenu } from "./ContextMenu";
import {
  MenuType,
  MenuPos,
  CONNECTOR,
  OperateType,
  Link,
  Node,
  NODE_WIDTH,
  NODE_HEIGHT,
  LINK_AREA
} from "./defines";
import { findNearbyNode } from "./utils/find";
import { calcLinkPosition } from "./utils/calc";
import { exitFullscreen, launchFullscreen, isFull, getOffset } from "../utils";


class CanvasContentProps {
  ref: any;
  nodes: Node[];
  links: Link[];
  setNodes: (nodes: Node[]) => void;
  setLinks: (links: Link[]) => void;
  selectedLinks: string[];
  setSelectedLinks: (links: string[]) => void;
  selectedNodes: string[];
  setSelectedNodes: (links: string[]) => void;
  /** å½åææ½çèç¹ */
  dragNode: Node;
  updateNodes: (node: Node) => void;
  updateLinks: (link: Link) => void;
  deleteNodes: (selectedNodes: string[]) => void;
  deleteLinks: (selectedLinks: string[]) => void;
  copiedNodes: Node[];
  setCopiedNodes: (nodes: Node[]) => void;
}

class CanvasContentState {
  /** ææ½èç¹ */
  isDraggingNode: boolean;
  /** ææ½è¾¹ */
  isDraggingLink: boolean;
  /** ææ½èç¹ */
  dragNode: Node;
  /** é¼ æ ä½ç½®å¨æå¨èç¹çåç§»é */
  dragNodeOffset: any;
  /** ç§»å¨è¾¹ */
  dragLink: {
    /** æºèµ·èç¹id */
    originId: string;
    /** æºèµ·èç¹ */
    originX: number;
    originY: number;
    /** é¼ æ ç§»å¨èç¹ */
    x: number;
    y: number;
    /** æ¥æºè¾¹ä½ç½® */
  };
  sourcePos: string;
  /** å¯¹è¯æ¡å±ç¤ºæ å¿ä½ */
  menuDisplay: boolean;
  /** å¯¹è¯æ¡çä½ç½®ä¿¡æ¯ */
  menuPos: MenuPos;
  /** ç»å¸çæ¾å¤§åç */
  screenScale: number;
  isKeyPressing: boolean;
  /** å½åé¼ æ æ¬æµ®çèç¹ */
  currentHoverNode: string;
  /** å é¤æ¡ */
  deleteVisible: boolean;
}

export default class CanvasContent extends React.Component<
  CanvasContentProps,
  CanvasContentState
> {
  currTrans: ZoomTransform;
  nodesContainerRef: any;
  container: any;
  handleApplyTransform: (transform: ZoomTransform) => void;
  screenWidth: number;
  screenHeight: number;

  autoVerticalScroller: any = null;
  autoHorizontalScroller: any = null;

  handleResize: (isLarge: boolean) => void;
  handleAdapt: () => void;
  handleResizeTo: (scale: number, P0?: [number, number]) => void;

  constructor(props) {
    super(props);
    this.state = {
      isDraggingNode: false,
      isDraggingLink: false,
      isKeyPressing: false,
      dragNode: null,
      dragLink: null,
      dragNodeOffset: null,
      menuDisplay: false,
      menuPos: {
        id: "",
        x: 0,
        y: 0
      },
      screenScale: 100,
      sourcePos: "",
      currentHoverNode: "",
      deleteVisible: false
    };
    this.nodesContainerRef = React.createRef();
    this.container = React.createRef();
    this.currTrans = zoomIdentity;

    this.openDialog = this.openDialog.bind(this);
  }

  componentDidMount() {
    this.nodesContainerRef.current.addEventListener(
      "mousedown",
      this.onNodesContainerMouseDown
    );
    this.container.current.addEventListener(
      "contextmenu",
      this.openContainerMenu
    );
    this.container.current.addEventListener("click", this.onContainerMouseDown);
  }

  componentWillUnmount() {
    this.nodesContainerRef.current.removeEventListener(
      "mousedown",
      this.onNodesContainerMouseDown
    );
    this.container.current.removeEventListener(
      "contextmenu",
      this.openContainerMenu
    );
    this.container.current.removeEventListener(
      "click",
      this.onContainerMouseDown
    );
  }

  componentWillUpdate(
    nextProps: CanvasContentProps,
    nextState: CanvasContentState
  ) {
    if (this.state.isDraggingNode !== nextState.isDraggingNode) {
      this.toggleDragNode(nextState.isDraggingNode);
    }
    if (this.state.isDraggingLink !== nextState.isDraggingLink) {
      this.toggleDragLink(nextState.isDraggingLink);
    }
  }

  /** æå¼å¨å±æä½èåï¼åæ¬å¤å¶ï¼ç²è´´ï¼å é¤ç­ */
  openContainerMenu = (event: any) => {
    event.preventDefault();
  };

  toggleDragNode = (isDraggingNode: Boolean) => {
    if (isDraggingNode) {
      window.addEventListener("mousemove", this.onDragNodeMouseMove);
      window.addEventListener("mouseup", this.onDragNodeMouseUp);
    } else {
      window.removeEventListener("mousemove", this.onDragNodeMouseMove);
      window.removeEventListener("mouseup", this.onDragNodeMouseUp);
    }
  };

  toggleDragLink = (isDraggingLink: Boolean) => {
    if (isDraggingLink) {
      window.addEventListener("mousemove", this.onDragLinkMouseMove);
      window.addEventListener("mouseup", this.onDragLinkMouseUp);
    } else {
      window.removeEventListener("mousemove", this.onDragLinkMouseMove);
      window.removeEventListener("mouseup", this.onDragLinkMouseUp);
    }
  };

  onDragLinkMouseMove = (event: any) => {
    event.stopPropagation();
    event.preventDefault();

    const { offsetTop, offsetLeft } = getOffset(this.container.current);
    const screenX = event.clientX - offsetLeft;
    const screenY = event.clientY - offsetTop;

    const { k, x, y } = this.currTrans;

    this.setState(preState => {
      const { dragLink } = preState;
      return {
        dragLink: {
          ...dragLink,
          x: (screenX - x) / k,
          y: (screenY - y) / k
        }
      };
    });
  };

  /** çå¬æ´ä¸ªåºåï¼æåæ§è½ */
  onNodesContainerMouseDown = (event: any) => {
    event.stopPropagation();
    const { nodes } = this.props;
    if (nodes && nodes.length > 0) {
      const component = _.find(nodes, c => {
        if (c.ref && c.ref.current) {
          return c.ref.current.contains(event.target);
        }
        return false;
      });

      const type = event.target.dataset && event.target.dataset.type;
      const position = event.target.dataset && event.target.dataset.position;

      if (component) {
        if (type === "edge" && position) {
          /** ææ½è¿çº¿ */
          this.onDragLinkMouseDown(component as any, position);
          return;
        } else if (type === "resize") {
          return;
        } else {
          /** ææ½èç¹ï¼æé¤resizeèç¹ */
          this.onDragNodeMouseDown(component as any, event);
        }
      }
    }
  };

  /** çå¬æ´ä¸ªå®¹å¨clickäºä»¶ */
  onContainerMouseDown = (event: any) => {
    // event.stopPropagation();

    // è¿æ»¤æèç¹åè¾¹
    const path = event.path;
    const isNodeOrLink = this.hasNodeOrLink(path, "editor-node", "editor-link");
    if (!isNodeOrLink) {
      // æ¸ç©ºé«äº®çèç¹åè¾¹
      this.handleClearActive();
    }
  };

  /** çå¬æ´ä¸ªå®¹å¨mousemove äºä»¶ */
  onNodesContainerMouseMove = (event: any) => {
    event.preventDefault();
    const path = event.path;
    const isNodeOrLink = this.hasNodeOrLink(path, "editor-node", "editor-link");
    const { nodes } = this.props;

    if (nodes && nodes.length > 0) {
      const currentNode = _.find(nodes, c => {
        if (c.ref && c.ref.current) {
          return c.ref.current.contains(event.target);
        }
        return false;
      }) as Node;

      if (currentNode) {
        if (isNodeOrLink) {
          this.setState({
            currentHoverNode: currentNode.id
          });
        } else {
          this.setState({
            currentHoverNode: ""
          });
        }
      }
    }
  };

  /** æä¸èç¹ */
  onDragNodeMouseDown = (node: Node, event: any) => {
    const { k, x, y } = this.currTrans;

    const { offsetTop, offsetLeft } = getOffset(this.container.current);
    const screenX = event.clientX - offsetLeft;
    const screenY = event.clientY - offsetTop;

    this.setState(preState => {
      // è®¡ç®é¼ æ ä½ç½®å¨èç¹ä¸­çåç§»é
      return {
        isDraggingNode: true,
        dragNode: node,
        dragNodeOffset: {
          x: (screenX - x) / k - node.x,
          y: (screenY - y) / k - node.y
        }
      };
    });
  };

  /** é¼ æ æä¸ï¼è¿è¡è¿çº¿ */
  onDragLinkMouseDown = (node: Node, position: string) => {
    const { x, y } = calcLinkPosition(node, position);
    this.setState({
      isDraggingLink: true,
      dragLink: {
        originId: node.id,
        originX: x,
        originY: y,
        x,
        y
      },
      sourcePos: position
    });
  };

  /** é¼ æ æ¬èµ·ï¼è¿çº¿ç»æ */
  onDragLinkMouseUp = (event: any) => {
    const { setLinks, links, nodes } = this.props;
    const { dragLink } = this.state;
    const { offsetTop, offsetLeft } = getOffset(this.container.current);
    const screenX = event.clientX - offsetLeft;
    const screenY = event.clientY - offsetTop;

    const { k, x, y } = this.currTrans;

    const nearNode = findNearbyNode(
      {
        x: (screenX - x) / k,
        y: (screenY - y) / k
      },
      nodes,
      LINK_AREA
    );

    // éè¦æ¾å°é¾æ¥çæ¯åªä¸ªèç¹

    if (nearNode) {
      const { targetNode, targetPos } = nearNode;
      const newLink = {
        id:
          dragLink.originId + CONNECTOR + targetNode.id + CONNECTOR + targetPos,
        source: dragLink.originId,
        target: targetNode.id,
        sourcePos: this.state.sourcePos,
        targetPos
      };
      setLinks([...links, newLink]);
    }

    this.setState({
      isDraggingLink: false,
      dragLink: null,
      sourcePos: ""
    });
  };

  /** ç§»å¨èç¹ */
  onDragNodeMouseMove = (event: any) => {
    event.preventDefault();
    event.stopPropagation();

    const { setNodes, nodes } = this.props;

    const { k, x, y } = this.currTrans;

    const { offsetTop, offsetLeft } = getOffset(this.container.current);
    const screenX = event.clientX - offsetLeft;
    const screenY = event.clientY - offsetTop;

    // å¤æ­å½åèç¹å¹³ç§»åæ¯å¦æº¢åºç»å¸
    // const isOver = this.checkNodeIsOverScreen(dragNode, screenX, screenY);

    // if (!isOver) {
    this.setState(preState => {
      const { dragNode, dragNodeOffset } = preState;

      const newX = (screenX - x) / k - dragNodeOffset.x;
      const newY = (screenY - y) / k - dragNodeOffset.y;

      return {
        ...preState,
        dragNode: {
          ...dragNode,
          x: newX,
          y: newY
        }
      };
    });

    const { dragNodeOffset, dragNode } = this.state;

    setNodes(
      nodes.map(c => {
        return c.id === dragNode.id
          ? {
              ...c,
              x: (screenX - x) / k - dragNodeOffset.x,
              y: (screenY - y) / k - dragNodeOffset.y
            }
          : c;
      })
    );
  };

  /** æ¾å¼èç¹ */
  onDragNodeMouseUp = (event: any) => {
    event.stopPropagation();
    // this.moveStop(true);
    // this.moveStop(false);

    this.setState(preState => {
      const { dragNode } = preState;

      return {
        ...preState
      };
    });
    this.setState({
      isDraggingNode: false
    });
  };

  getTransformInfo = (currTrans: ZoomTransform) => {
    this.currTrans = currTrans;
  };

  getScreenHandler = handleMap => {
    this.handleApplyTransform = handleMap.handleApplyTransform;
    this.handleResize = handleMap.handleResize;
    this.handleResizeTo = handleMap.handleResizeTo;
    this.handleAdapt = handleMap.handleAdapt;
    this.screenWidth = handleMap.screenWidth;
    this.screenHeight = handleMap.screenHeight;
  };

  onDrag(event, name: string) {}

  onDrop(event: React.DragEvent<HTMLDivElement>) {
    const { setNodes, nodes, dragNode } = this.props;
    const { offsetTop, offsetLeft } = getOffset(this.container.current);
    const screenX = event.clientX - offsetLeft;
    const screenY = event.clientY - offsetTop;

    const { k, x, y } = this.currTrans;

    if (dragNode) {
      const { key, name, type, width, height } = dragNode;

      const newNode = {
        key,
        name,
        type,
        width,
        height,
        x: (screenX - x) / k - NODE_WIDTH / 2,
        y: (screenY - y) / k - NODE_HEIGHT / 2,
        id: uuid.v4(),
        ref: React.createRef()
      };

      setNodes([...nodes, newNode]);
    }
  }

  /** ç¹å»æå¼èåæ  */
  openDialog(
    id: string,
    type: MenuType,
    event: React.MouseEvent<HTMLLIElement>
  ) {
    event.preventDefault();
    event.stopPropagation();
    const { k, x, y } = this.currTrans;
    const { offsetTop, offsetLeft } = getOffset(this.container.current);
    const screenX = event.clientX - offsetLeft;
    const screenY = event.clientY - offsetTop;

    const newX = (screenX - x) / k;
    const newY = (screenY - y) / k;
    this.setState({
      menuDisplay: true,
      menuPos: {
        id,
        x: newX,
        y: newY
      }
    });
  }

  /** æ¸ç©ºé«äº®ç»ä»¶åè¿çº¿ */
  handleClearActive = () => {
    this.props.setSelectedLinks([]);
    this.props.setSelectedNodes([]);
  };

  /** å¤æ­ç¹å»çèç¹æ¯å¦ä¸ºèç¹åè¾¹ */
  hasNodeOrLink = (array: any[], node?: string, link?: string) => {
    let isNodeOrLink = false;

    for (let i = 0; i < array.length; i++) {
      const inNode = _.includes(array[i].classList, node);
      const inLink = _.includes(array[i].classList, link);

      if (inNode || inLink) {
        isNodeOrLink = true;
        break;
      }
    }
    return isNodeOrLink;
  };

  /** æ¹åç¼©æ¾åç */
  changeScreenScale = (screenScale: number) => {
    this.setState({
      screenScale
    });
  };

  /** å¤çå¨å±äºä»¶ */
  handleFullScreen = () => {
    const fullScreen = isFull();
    if (fullScreen) {
      exitFullscreen();
    } else {
      launchFullscreen(this.container.current);
    }
  };

  renderDragSource() {
    const dragSourceList = ["ç»ä»¶1", "ç»ä»¶2"];

    return (
      <div className="flow-drag-source">
        {dragSourceList.map((name, index) => {
          return (
            <div
              className="flow-drag-source-item"
              key={index}
              draggable
              onDrag={event => this.onDrag(event, name)}
            >
              {name}
            </div>
          );
        })}
      </div>
    );
  }

  /** ç¹å»è¿çº¿ */
  onSelectLink = (key: string) => {
    const { selectedLinks, setSelectedLinks } = this.props;
    if (selectedLinks) {
      // è¥è¿çº¿å·²é«çº¿ï¼ååæ¶é«äº®ç¶æ
      const index = _.findIndex(selectedLinks, link => link === key);
      if (index > -1) {
        setSelectedLinks([
          ...selectedLinks.slice(0, index),
          ...selectedLinks.slice(index + 1)
        ]);
      } else {
        setSelectedLinks([...selectedLinks, key]);
      }
    } else {
      setSelectedLinks([key]);
    }
  };

  /** ç¹å»èç¹ */
  onClickNode = (currentNode: Node) => {
    const { selectedNodes, setSelectedNodes } = this.props;
    const { isKeyPressing } = this.state;
    // åºåå¤éæé®æ¯å¦æä¸
    if (isKeyPressing) {
      if (selectedNodes) {
        // è¥èç¹å·²è¢«ç¹å»åæ¸é¤ç¹å»ç¶æ
        const index = _.findIndex(selectedNodes, id => id === currentNode.id);
        if (index > -1) {
          setSelectedNodes([
            ...selectedNodes.slice(0, index),
            ...selectedNodes.slice(index + 1)
          ]);
        } else {
          setSelectedNodes(_.compact([...selectedNodes, currentNode.id]));
        }
      } else {
        setSelectedNodes([currentNode.id]);
      }
    } else {
      this.props.setSelectedNodes([currentNode.id]);
      // æ¸ç©ºé«äº®çè¿çº¿
      this.props.setSelectedLinks(null);
    }
  };

  /** è¢«è¿çº¿çèç¹ */
  onSelectNode = (currentNode: Node, key: OperateType) => {
    const { selectedNodes, deleteNodes } = this.props;
    if (key === OperateType.delete) {
      // å é¤ç»ä»¶ä»¥åå é¤è¿çº¿
      // å¤æ­æ¹èç¹æ¯å¦å¨å¤éåºåå
      if (selectedNodes && selectedNodes.includes(currentNode.id)) {
        deleteNodes(_.compact([...selectedNodes, currentNode.id]));
      } else {
        deleteNodes([currentNode.id]);
      }
    }
  };

  /** å³é®è¿çº¿ */
  onContextMenuLink = (
    key: string,
    event: React.MouseEvent<SVGPathElement, MouseEvent>
  ) => {
    event.preventDefault();
    event.stopPropagation();
    this.props.setSelectedLinks([key]);
    // æ¸ç©ºé«äº®çç»ä»¶
    this.props.setSelectedNodes(null);

    const currentPos = {
      x: event.clientX,
      y: event.clientY
    };
    this.setState({
      deleteVisible: true,
      menuPos: currentPos
    });
  };

  /** ä¼¸ç¼©èç¹ */
  onResize = (
    node: Node,
    width: number,
    height: number,
    x: number,
    y: number
  ) => {
    const { updateNodes } = this.props;
    const newNode = {
      ...node,
      width,
      height,
      x,
      y
    };
    updateNodes(newNode);
  };

  renderCanvas = () => {
    const { currentHoverNode } = this.state;
    const { nodes, links, selectedNodes, selectedLinks } = this.props;
    return (
      <div className="editor-view">
        <div className="editor-view-content" ref={this.nodesContainerRef}>
          {nodes.map(child => {
            const id = child.id;
            const isSelected = selectedNodes
              ? selectedNodes.includes(id)
              : false;
            const showSelector = isSelected || currentHoverNode === id;
            return (
              <EditorNode
                nodeRef={child.ref}
                currentNode={child}
                key={id}
                onClick={this.onClickNode}
                isSelected={isSelected}
                showSelector={showSelector}
                onResize={this.onResize.bind(this, child)}
                currTrans={this.currTrans}
                onSelect={this.onSelectNode}
              />
            );
          })}
          <EditorEdges
            links={links}
            nodes={nodes}
            selectedLinks={selectedLinks}
            onContextMenu={this.onContextMenuLink}
            onSelectLink={this.onSelectLink}
            isDraggingLink={this.state.isDraggingLink}
            dragLink={this.state.dragLink}
          />
        </div>
      </div>
    );
  };

  render() {
    const { deleteVisible, menuPos } = this.state;
    return (
      <div className="canvas-container-content" ref={this.container}>
        <ReScreen
          type="DOM"
          getScreenHandler={this.getScreenHandler}
          needMinimap={true}
          needRefresh={true}
          zoomEnabled={false}
          mapPosition="RB-IN"
          mapWidth={320}
          mapHeight={120}
          onScreenChange={this.getTransformInfo}
          onDragOver={event => {
            event.preventDefault();
          }}
          onDrop={this.onDrop.bind(this)}
        >
          {this.renderCanvas()}
        </ReScreen>
        {/** å é¤è¿çº¿çèå */}
        <ContextMenu
          visible={deleteVisible}
          // onHide={() => {
          //   this.props.setLinks(null);
          //   this.setState({
          //     deleteVisible: false
          //   });
          // }}
          left={menuPos.x}
          top={menuPos.y}
          // onClick={this.handleDeleteLinks.bind(this, selectedLinks)}
        >
          <Menu
            getPopupContainer={(triggerNode: any) => triggerNode.parentNode}
          >
            {[
              {
                name: "å é¤",
                key: OperateType.delete
              }
            ].map(child => {
              return <Menu.Item key={child.key}>{child.name}</Menu.Item>;
            })}
          </Menu>
        </ContextMenu>
      </div>
    );
  }
}
