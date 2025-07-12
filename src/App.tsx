

import { useEffect, useMemo, useRef, useState } from 'react'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'

import styles from './App.module.css'
import React from 'react';

const BOARD_WIDTH = 11;
const BOARD_HEIGHT = 5;
const CELL_SIZE = 48; // px

const COLORS = {
    GREEN: "#52C41A",
    ORANGE: "#FA8C16",
    RED: "#FF4D4F",
    GREY: "#BFBFBF",
    SKYBLUE: "#87CEEB",
    BLUE: "#1890FF",
    PURPLE: "#722ED1",
    PINK: "#ec28abff",
    YELLOW: "#FAAD14",
    LIGHTGREEN: "#45fc7cff",
    WHITE: "#4e4e4eff",
    MAGENTA: "#ac2595ff",
}



const ANIMATION_DURATION = 300; // ms

type Cell = string | null // null for empty cell, string for piece color

type Shape = Cell[][];
// types
type Piece = {
    shape: Shape;
    color?: string; // possible override
    boardCoord?: Coord; // position on board
    pixelCoord?: Coord; // position in pixels
}

type Direction = 'left' | 'right' | 'flipHorizontal' | 'flipVertical';

type Coord = {
    x: number;
    y: number;
    color?: string;
}

type Connections = {
    left?: boolean;
    right?: boolean;
    top?: boolean;
    bottom?: boolean;
}
function ControlsSlideout() {
    const [open, setOpen] = useState(false);
    return (
        <>
            <aside className={open ? `${styles.controlsSlideout} ${styles.open}` : styles.controlsSlideout}>
                <div className={styles.controlsInfo}>
                    <h2>How to Play & Controls</h2>
                    <ul>
                        <li><b>Drag & Drop:</b> Drag pieces from the selection area onto the board.</li>
                        <li><b>Remove Piece:</b> Click a placed piece to pick it up again.</li>
                        <li><b>Rotate:</b> While dragging, use <b>A</b> (left) and <b>D</b> (right) to rotate the piece 90°.</li>
                        <li><b>Flip:</b> While dragging, use <b>W</b> (vertical) and <b>S</b> (horizontal) to flip the piece.</li>
                        <li><b>Snap:</b> Pieces will highlight valid drop positions as you move them over the board.</li>
                        <li><b>Keyboard:</b> Hold and drag a piece, then use keys for rotation/flipping.</li>
                    </ul>
                </div >
            </aside>
            <button className={styles.controlsToggleBtn} onClick={() => setOpen(o => !o)} aria-label={open ? 'Hide controls' : 'Show controls'}>
                {open ? 'X' : '☰'}
            </button>
        </>
    );
}
function GameBoard({ gameBoard, gameBoardRef, removePiece }: { gameBoard: Cell[][], gameBoardRef: React.RefObject<HTMLDivElement | null>, removePiece: (coord: Coord) => void }) {

    const getConnections = (rowIndex: number, cellIndex: number): Connections => {
        const cell = gameBoard[rowIndex][cellIndex];
        if (cell !== null && cell === 'highlight') return {};

        const left = cellIndex - 1 >= 0 && gameBoard[rowIndex][cellIndex - 1];
        const right = cellIndex + 1 <= gameBoard[0].length && gameBoard[rowIndex][cellIndex + 1];
        const bottom = rowIndex + 1 < gameBoard.length && gameBoard[rowIndex + 1][cellIndex];
        const top = rowIndex - 1 >= 0 && gameBoard[rowIndex - 1][cellIndex];

        return {
            left: left !== null && left === cell,
            right: right !== null && right === cell,
            top: top !== null && top === cell,
            bottom: bottom !== null && bottom === cell,
        }
    }

    return (
        <div className={styles.gameBoardContainer}>
            <div className={styles.gameBoard} ref={gameBoardRef}>
                {gameBoard.map((row, index) => (
                    <div className={styles.gameBoardRow} key={index}>
                        {row.map((cell, cellIndex) => (
                            <Cell
                                cell={cell}
                                cellIndex={cellIndex}
                                onMouseDown={(e: any) => {
                                    cell ? removePiece({
                                        x: e.clientX,
                                        y: e.clientY,
                                    }) : undefined
                                }}
                                isHole={!cell}
                                connections={getConnections(index, cellIndex)}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

const Cell = ({ cell, cellIndex, onMouseDown, isHole, connections }: { cell: Cell, cellIndex: number, onMouseDown?: any, isHole?: boolean, connections: Connections }) => {
    let cellClass = styles.emptyCell;
    let cellStyles = 'transparent';
    if (cell === 'highlight') {
        cellClass = styles.holeCell;
        cellStyles = '#8a8a8aff';
    }
    else if (isHole) {
        cellClass = styles.holeCell;
        cellStyles = "#ccc";
    } else if (cell) {
        cellClass = styles.pieceCell;
        cellStyles = cell;
    }

    return (
        <div
            key={cellIndex}
            className={styles.cellContainer}
            onMouseDown={onMouseDown}
        >
            {/* Cell */}
            <div
                key={cellIndex}
                className={cellClass}
                style={{ background: cellStyles }}
            />
            {/* Bridges / Connections */}
            <div className={styles.bridges}>
                {connections.left && <div className={styles.bridgeLeft} style={{ background: cellStyles }} />}
                {connections.right && <div className={styles.bridgeRight} style={{ background: cellStyles }} />}
                {connections.bottom && <div className={styles.bridgeBottom} style={{ background: cellStyles }} />}
                {connections.top && <div className={styles.bridgeTop} style={{ background: cellStyles }} />}
            </div>

        </div>
    )
}

const Piece = ({ piece, boardApi }: {
    piece: Piece,
    boardApi: {
        fitPiece: (piece: Piece, coord: Coord) => void,
        seePiece: (piece: Piece, coord: Coord, justClear: boolean) => void,
        canFit: (piece: Piece, coord: Coord, place: boolean) => boolean,
        getCellPosition: (coord: Coord) => Coord | null,
        rotatePiece: (piece: Piece, direction: Direction, times: number) => void
    }
}) => {
    const { fitPiece, seePiece, canFit, getCellPosition, rotatePiece } = boardApi;
    const [isDragging, setIsDragging] = React.useState(false);
    const isDraggingRef = React.useRef(isDragging);
    const pieceRef = React.useRef<HTMLDivElement>(null);
    const [position, setPosition] = React.useState<Coord | null>(null);
    const positionRef = React.useRef<Coord | null>(null);
    const mouseRef = React.useRef<{ x: number, y: number } | null>(null);
    const [isRotating, setIsRotating] = React.useState(false);
    const isFlippingY = React.useRef<boolean>(false);
    const isFlippingX = React.useRef<boolean>(false);
    const isRotatingZ = React.useRef<boolean>(false);
    const [angle, setAngle] = React.useState(0);
    const [yAngle, setYAngle] = React.useState(0);
    const [xAngle, setXAngle] = React.useState(0);
    const timeoutRef = React.useRef<null | number>(null);
    const pieceRefState = React.useRef(piece);
    const prevCoord = useRef<Coord | null>(null);


    useEffect(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        if (angle == 0 && yAngle == 0 && xAngle == 0) {
            isRotatingZ.current = false;
            isFlippingY.current = false;
            isFlippingX.current = false;
            return;
        }
        timeoutRef.current = setTimeout(() => {
            if (isRotatingZ.current) {
                rotatePiece(pieceRefState.current, angle > 0 ? 'right' : 'left', Math.abs(angle / 90));
                isRotatingZ.current = false;
            }
            if (isFlippingY.current) {
                rotatePiece(pieceRefState.current, 'flipHorizontal', Math.abs(yAngle / 180));
                isFlippingY.current = false;
            }
            if (isFlippingX.current) {
                rotatePiece(pieceRefState.current, 'flipVertical', Math.abs(xAngle / 180));
                isFlippingX.current = false;
            }
            setIsRotating(false);
        }, ANIMATION_DURATION);
    }, [angle, yAngle, xAngle])

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.repeat || !isDraggingRef.current) return;

        const canFlipY = !isRotatingZ.current && !isFlippingX.current;
        const canFlipX = !isRotatingZ.current && !isFlippingY.current;
        const canRotateZ = !isFlippingY.current && !isFlippingX.current;
        if (event.key === 'A' && canFlipY) {
            isFlippingY.current = true;
            setYAngle((prevAngle) => (prevAngle + 180));
        }
        else if (event.key === 'D' && canFlipY) {
            isFlippingY.current = true;
            setYAngle((prevAngle) => (prevAngle - 180));
        }
        else if (event.key === 'W' && canFlipX) {
            isFlippingX.current = true;
            setXAngle((prevAngle) => (prevAngle + 180));
        }
        else if (event.key === 'S' && canFlipX) {
            isFlippingX.current = true;
            setXAngle((prevAngle) => (prevAngle - 180));
        }
        else if (event.key === 'a' && !yAngle && canRotateZ) {
            isRotatingZ.current = true;
            setAngle((prevAngle) => (prevAngle - 90));
        } else if (event.key === 'd' && !yAngle && canRotateZ) {
            isRotatingZ.current = true;
            setAngle((prevAngle) => (prevAngle + 90));
        }
        setIsRotating(true);
    };

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [piece, rotatePiece]);

    const handleMouseMove = (event: MouseEvent) => {
        const newPos = {
            x: event.clientX - (pieceRef.current?.offsetWidth || 0) / 2,
            y: event.clientY - (pieceRef.current?.offsetHeight || 0) / 2
        };

        setPosition(newPos);
        mouseRef.current = {
            x: event.clientX,
            y: event.clientY
        };
        positionRef.current = newPos;

        if (positionRef.current) {
            const topLeft = { ...positionRef.current };
            topLeft.x += CELL_SIZE / 2;
            topLeft.y += CELL_SIZE / 2;
            const coord = getCellPosition(topLeft);
            if (coord && canFit(pieceRefState.current, coord, false)) {
                seePiece(pieceRefState.current, coord, false);
            } else if (coord && prevCoord.current && (prevCoord.current.x != coord.x || prevCoord.current.y != coord.y)) {
                seePiece(pieceRefState.current, coord, true);
            }
            prevCoord.current = coord;
        }

    }

    const handleMouseup = () => {
        // Check if piece is dropped on board
        let topLeft = { x: 0, y: 0 };
        if (positionRef.current) {
            topLeft = positionRef.current;
            topLeft.x += CELL_SIZE / 2;
            topLeft.y += CELL_SIZE / 2;
        }
        const coord = getCellPosition(topLeft);
        if (coord && canFit(pieceRefState.current, coord, true)) {
            fitPiece(pieceRefState.current, coord);
        }
        setPosition(null);
        setIsDragging(false);
        isDraggingRef.current = false;
        positionRef.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseup);
    }
    const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        handleMouseMove(event as unknown as MouseEvent);
        setIsDragging(true);
        isDraggingRef.current = true;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseup);
    }
    useMemo(() => {
        pieceRefState.current = piece;
        if (mouseRef.current && pieceRef.current) {
            const newCenter = (angle % 180) == 0;
            const newOffsetX = newCenter ? pieceRef.current?.offsetWidth : pieceRef.current?.offsetHeight;
            const newOffsetY = newCenter ? pieceRef.current?.offsetHeight : pieceRef.current?.offsetWidth;
            const newPos = {
                x: mouseRef.current.x - newOffsetX / 2,
                y: mouseRef.current.y - newOffsetY / 2,
            };
            setPosition(newPos);
            positionRef.current = newPos;
        }
        setAngle(0);
        setYAngle(0);
        setXAngle(0);

    }, [piece])

    useMemo(() => {
        if (piece.pixelCoord) {
            const newPos = {
                x: piece.pixelCoord.x - piece.shape[0].length *
                    CELL_SIZE / 2,
                y: piece.pixelCoord.y - piece.shape.length *
                    CELL_SIZE / 2,
            };
            setPosition(newPos);
            positionRef.current = newPos;
            setIsDragging(true);
            isDraggingRef.current = true;
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseup);
        }
    }, [])


    const rotatingStyles = {
        transition: isRotating ? `transform ${ANIMATION_DURATION}ms ease` : 'unset',
        transform: isRotating ? `rotateZ(${angle}deg) rotateY(${yAngle}deg) rotateX(${xAngle}deg)` : 'unset',
    }

    const movingStyles = position && isDragging ? {
        left: position?.x,
        top: position?.y,
    } : {}

    return (
        <div className={styles.piece}
            ref={pieceRef}
            onMouseDown={handleMouseDown}
            style={
                (position || isDragging) ? {
                    position: position && isDragging ? 'absolute' : 'relative',
                    cursor: 'grabbing',
                    ...movingStyles,
                    ...rotatingStyles,
                } : {
                    cursor: 'grab',
                    ...rotatingStyles,
                }

            }
        >
            {piece.shape.map((row, rowIndex) => (
                <div key={rowIndex} className={styles.pieceRow}>
                    {row.map((cell, cellIndex) => (
                        <Cell cell={cell} cellIndex={cellIndex}
                            connections={{
                                left: cellIndex - 1 >= 0 && piece.shape[rowIndex][cellIndex - 1] !== null,
                                right: cellIndex + 1 < piece.shape[0].length && piece.shape[rowIndex][cellIndex + 1] !== null,
                                bottom: rowIndex + 1 < piece.shape.length && piece.shape[rowIndex + 1][cellIndex] !== null,
                                top: rowIndex - 1 >= 0 && piece.shape[rowIndex - 1][cellIndex] !== null,
                            }}
                        />

                    ))}
                </div>
            ))}
        </div>
    );
};

function App() {
    const [gameBoard, setGameBoard] = useState(Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null)) as Cell[][]);
    const gameBoardRef = useRef<HTMLDivElement>(null);

    const { pieces, rotatePiece, addPieceToBoard, removePieceFromBoard, resetPieces } = usePieces();
    const [won, setWon] = useState(false);
    const { width, height } = useWindowSize()

    const getCellPosition = (coord: Coord): Coord | null => {
        if (!gameBoardRef.current) return null;

        const boardRect = gameBoardRef.current.getBoundingClientRect();

        // add half of cell size to center the piece when detecting collision
        const coordXOnBoard = coord.x - boardRect.x;
        const coordYOnBoard = coord.y - boardRect.y;
        const column = Math.floor(BOARD_WIDTH * coordXOnBoard / boardRect.width)
        const row = Math.floor(BOARD_HEIGHT * coordYOnBoard / boardRect.height)

        return {
            x: column,
            y: row
        }

    }
    /**
     * highlight piece on board
     * 
     * @param coord cell row and column on board
     */
    const seePiece = (piece: Piece, coord: Coord, justClear: boolean): void => {
        const row = coord.y;
        const column = coord.x;

        const updatedGameBoard = [...gameBoard];

        const shape = piece.shape;

        // set cell colors
        for (let i = 0; i < gameBoard.length; i++) {
            for (let j = 0; j < gameBoard[i].length; j++) {
                if (gameBoard[i][j] === 'highlight') {
                    updatedGameBoard[i][j] = null; // clear highlight
                }
            }
        }
        if (justClear) {
            setGameBoard(updatedGameBoard);
            return;
        }
        // set cell colors
        for (let i = 0; i < shape.length; i++) {
            for (let j = 0; j < shape[i].length; j++) {
                const cellValue = shape[i][j];
                if (cellValue) {
                    updatedGameBoard[row + i][column + j] = 'highlight';
                }
            }
        }

        setGameBoard(updatedGameBoard)
    }

    /**
     * put the piece on the baord
     * 
     * @param coord cell row and column on board
     */
    const fitPiece = (piece: Piece, coord: Coord): void => {
        const row = coord.y;
        const column = coord.x;

        const updatedGameBoard = [...gameBoard];

        const shape = piece.shape;

        for (let i = 0; i < gameBoard.length; i++) {
            for (let j = 0; j < gameBoard[i].length; j++) {
                if (gameBoard[i][j] === 'highlight') {
                    updatedGameBoard[i][j] = null; // clear highlight
                }
            }
        }

        for (let i = 0; i < shape.length; i++) {
            for (let j = 0; j < shape[i].length; j++) {
                const cellValue = shape[i][j];
                if (cellValue) {
                    updatedGameBoard[row + i][column + j] = cellValue;
                }
            }
        }

        setGameBoard(updatedGameBoard)

        // add to game board (also removed from pieces)
        addPieceToBoard(piece, coord);




    }

    /**
     * Check if piece can fit on board
     * 
     * @param coord cell row and column on board
     * @returns if piece can fit on board
     */
    const canFit = (piece: Piece, coord: Coord, place: boolean): boolean => {
        const row = coord.y;
        const column = coord.x;

        const shape = piece.shape;

        let highlighted = 0;
        let numberOfCells = 0
        // Check if all cells fit
        for (let i = 0; i < shape.length; i++) {
            for (let j = 0; j < shape[i].length; j++) {
                const cellValue = shape[i][j];
                if (cellValue) {
                    numberOfCells++;
                    const boardRow = row + i;
                    const boardColumn = column + j;

                    // Check if cell is out of bounds
                    if (boardRow < 0 || boardRow >= BOARD_HEIGHT || boardColumn < 0 || boardColumn >= BOARD_WIDTH) {
                        return false;
                    }

                    // Check if cell is already occupied
                    if (gameBoard[boardRow][boardColumn] === 'highlight') {
                        highlighted++;
                    }
                    if (gameBoard[boardRow][boardColumn] && gameBoard[boardRow][boardColumn] !== 'highlight') {
                        return false;
                    }
                }
            }
        }
        if (highlighted === numberOfCells && !place) {
            return false;
        }

        return true;
    }

    // mouse coords
    const removePiece = (coord: Coord): void => {
        const boardCoord = getCellPosition(coord)
        if (!boardCoord) return;
        pieces.forEach(piece => {
            if (piece.boardCoord) {
                if (shapeHasCellAtBoardCoord(piece, boardCoord)) {
                    // remove piece from board and set position to grab at
                    removePieceFromBoard(piece, coord);

                    const updatedGameBoard = [...gameBoard];
                    // remove piece from game board
                    for (let i = 0; i < piece.shape.length; i++) {
                        for (let j = 0; j < piece.shape[i].length; j++) {
                            if (piece.shape[i][j]) {
                                const boardRow = piece.boardCoord.y + i;
                                const boardColumn = piece.boardCoord.x + j;
                                if (boardRow >= 0 && boardRow < BOARD_HEIGHT && boardColumn >= 0 && boardColumn < BOARD_WIDTH) {
                                    updatedGameBoard[boardRow][boardColumn] = null; // clear cell
                                }
                            }
                        }
                    }

                    setGameBoard(updatedGameBoard);
                }
            }
        })
    }

    const resetGame = () => {
        setGameBoard(
            Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null)) as Cell[][]
        )
        resetPieces();
        setWon(false);
    }

    // Group board-related functions into a single boardApi prop for Piece
    const boardApi = useMemo(() => ({
        fitPiece,
        seePiece,
        canFit,
        getCellPosition,
        rotatePiece
    }), [fitPiece, canFit, getCellPosition, rotatePiece]);

    // Check for win condition all pieces have boardCoord
    useEffect(() => {
        if (pieces.length > 0 && pieces.every(p => p.boardCoord)) {
            setWon(true);
        } else if (won) {
            setWon(false);
        }
    }, [pieces]);

    return (
        <>
            <ControlsSlideout />
            <Controls resetGame={resetGame} />
            <div className={styles.game}>
                <GameBoard gameBoard={gameBoard} gameBoardRef={gameBoardRef} removePiece={removePiece} />
                {/* Piece selection area */}
                <div className={styles.pieceSelectionArea}>
                    {pieces.map((piece, index) => {
                        if (piece.boardCoord) return null; // Skip already placed pieces
                        return <Piece
                            key={`{${piece.color}-${index}}`}
                            piece={piece}
                            boardApi={boardApi}
                        />
                    })}
                </div>
            </div>
            {won && (
                <Confetti
                    width={width}
                    height={height}
                />
            )}
        </>
    )
}

const Controls = ({ resetGame }: { resetGame: () => void }) => {
    return (
        <div className={styles.controlsContainer} >
            <button className={styles.controlButton}
                onClick={resetGame}
            >Reset</button>
        </div >
    )
}
const usePieces = () => {

    const rotatePiece = (piece: Piece, direction: Direction, times: number): void => {
        const cloneShape = (shape: Shape): Shape => shape.map(row => [...row]);
        // Rotate 90 degrees right
        const rotateRight = (shape: Shape): Shape => {
            const rows = shape.length;
            const cols = shape[0].length;
            return Array.from({ length: cols }, (_, i) =>
                Array.from({ length: rows }, (_, j) => shape[rows - 1 - j][i])
            );
        };
        // Rotate 90 degrees left
        const rotateLeft = (shape: Shape): Shape => {
            const rows = shape.length;
            const cols = shape[0].length;
            return Array.from({ length: cols }, (_, i) =>
                Array.from({ length: rows }, (_, j) => shape[j][cols - 1 - i])
            );
        };
        // Remove all-zero rows and columns from all sides
        const trim = (shape: Shape): Shape => {
            let matrix = cloneShape(shape);
            // Remove all-zero rows from top
            while (matrix.length && matrix[0].every(cell => !cell)) matrix.shift();
            // Remove all-zero rows from bottom
            while (matrix.length && matrix[matrix.length - 1].every(cell => !cell)) matrix.pop();
            // Remove all-zero columns from left
            while (matrix.length && matrix.every(row => !row[0])) matrix.forEach(row => row.shift());
            // Remove all-zero columns from right
            while (matrix.length && matrix[0].length && matrix.every(row => !row[row.length - 1])) matrix.forEach(row => row.pop());
            return matrix;
        };
        // Flip horizontally (mirror over vertical axis)
        const flipHorizontal = (shape: Shape): Shape => {
            return shape.map(row => [...row].reverse());
        };
        // Flip vertically (mirror over horizontal axis)
        const flipVertical = (shape: Shape): Shape => {
            return [...shape].reverse();
        };
        let newShape = cloneShape(piece.shape);
        for (let i = 0; i < times; i++) {
            if (direction === 'right') {
                newShape = rotateRight(newShape);
            } else if (direction === 'left') {
                newShape = rotateLeft(newShape);
            } else if (direction === 'flipHorizontal') {
                newShape = flipHorizontal(newShape);
            } else if (direction === 'flipVertical') {
                newShape = flipVertical(newShape);
            }
        }
        newShape = trim(newShape);
        setPieces(prevPieces => {
            return prevPieces.map(p => {
                if (p === piece) {
                    return { ...p, shape: newShape };
                }
                return p;
            });
        });
    }

    const addPieceToBoard = (piece: Piece, boardCoord: Coord): void => {
        setPieces(prevPieces => {
            return prevPieces.map(p => {
                if (p === piece) {
                    return { ...p, boardCoord };
                }
                return p;
            });
        })
    }
    const removePieceFromBoard = (piece: Piece, pixelCoord: Coord): void => {
        setPieces(prevPieces => {
            return prevPieces.map(p => {
                if (p === piece) {
                    return { ...p, boardCoord: undefined, pixelCoord };
                }
                return p;
            });
        });
    }

    const resetPieces = () => {
        setPieces(kanoodlePieces);
    }

    const [pieces, setPieces] = useState<Piece[]>(kanoodlePieces)

    return { pieces, rotatePiece, addPieceToBoard, removePieceFromBoard, resetPieces }

}
const kanoodlePieces: Piece[] = [
    {
        shape: [
            [COLORS.RED, COLORS.RED, null],
            [COLORS.RED, COLORS.RED, COLORS.RED]
        ], color: COLORS.RED
    },
    {
        shape: [
            [null, COLORS.GREY, null],
            [COLORS.GREY, COLORS.GREY, COLORS.GREY],
            [null, COLORS.GREY, null]
        ],
        color: COLORS.GREY
    },
    {
        shape: [
            [COLORS.ORANGE, COLORS.ORANGE],
            [COLORS.ORANGE, null],
            [COLORS.ORANGE, null]
        ],
        color: COLORS.ORANGE
    },
    {
        shape: [
            [COLORS.YELLOW, COLORS.YELLOW, COLORS.YELLOW],
            [COLORS.YELLOW, null, COLORS.YELLOW]
        ],
        color: COLORS.YELLOW
    },
    {
        shape: [
            [COLORS.PURPLE, COLORS.PURPLE, COLORS.PURPLE, COLORS.PURPLE]
        ],
        color: COLORS.PURPLE
    },
    {
        shape: [
            [COLORS.BLUE, COLORS.BLUE, COLORS.BLUE, COLORS.BLUE],
            [null, null, null, COLORS.BLUE]
        ],
        color: COLORS.BLUE
    },
    {
        shape: [
            [COLORS.SKYBLUE, COLORS.SKYBLUE, COLORS.SKYBLUE],
            [null, null, COLORS.SKYBLUE],
            [null, null, COLORS.SKYBLUE],
        ],
        color: COLORS.BLUE
    },
    {
        shape: [
            [COLORS.PINK, COLORS.PINK, COLORS.PINK, COLORS.PINK],
            [null, null, COLORS.PINK, null]
        ],
        color: COLORS.BLUE
    },
    {
        shape: [
            [COLORS.MAGENTA, COLORS.MAGENTA, null],
            [null, COLORS.MAGENTA, COLORS.MAGENTA],
            [null, null, COLORS.MAGENTA],
        ],
        color: COLORS.BLUE
    },
    {
        shape: [
            [COLORS.WHITE, COLORS.WHITE],
            [null, COLORS.WHITE],
        ],
        color: COLORS.BLUE
    },
    {
        shape: [
            [COLORS.GREEN, COLORS.GREEN, null, null],
            [null, COLORS.GREEN, COLORS.GREEN, COLORS.GREEN],
        ],
        color: COLORS.BLUE
    },
    {
        shape: [
            [COLORS.LIGHTGREEN, COLORS.LIGHTGREEN],
            [COLORS.LIGHTGREEN, COLORS.LIGHTGREEN],
        ],
        color: COLORS.BLUE
    },
];

// Returns true if any cell in the piece's shape matches the given boardCoord
function shapeHasCellAtBoardCoord(piece: Piece, boardCoord: Coord): boolean {
    if (!piece.boardCoord) return false;
    const { x: baseX, y: baseY } = piece.boardCoord;
    for (let i = 0; i < piece.shape.length; i++) {
        for (let j = 0; j < piece.shape[i].length; j++) {
            if (piece.shape[i][j]) {
                if (baseX + j === boardCoord.x && baseY + i === boardCoord.y) {
                    return true;
                }
            }
        }
    }
    return false;
}

export default App;
